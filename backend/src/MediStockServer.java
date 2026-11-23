import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.sql.*;
import java.util.*;
import java.util.concurrent.Executors;

/** MediStock API: Java built-in HTTP server + JDBC + TiDB Cloud (MySQL protocol). */
public class MediStockServer {
    private static final Map<String, String> DOTENV = loadDotEnv();
    private static final int PORT = Integer.parseInt(env("PORT", env("APP_PORT", "8080")));
    private static final String DB_HOST = env("TIDB_HOST", "YOUR_TIDB_HOST");
    private static final String DB_PORT = env("TIDB_PORT", "4000");
    private static final String DB_NAME = env("TIDB_DATABASE", "medistock");
    private static final String DB_USER = env("TIDB_USER", "YOUR_TIDB_USERNAME");
    private static final String DB_PASSWORD = env("TIDB_PASSWORD", "YOUR_TIDB_PASSWORD");
    private static final Set<String> ALLOWED_ORIGINS = parseOrigins(
            env("FRONTEND_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501"));
    private static final long SESSION_TTL_MILLIS = 12 * 60 * 60 * 1000L;
    private static final Map<String, Long> SESSIONS = new java.util.concurrent.ConcurrentHashMap<>();

    public static void main(String[] args) throws Exception {
        if (DB_HOST.startsWith("YOUR_") || DB_USER.startsWith("YOUR_") || DB_PASSWORD.startsWith("YOUR_")) {
            throw new IllegalStateException("Set TIDB_HOST, TIDB_USER and TIDB_PASSWORD environment variables before starting.");
        }
        Class.forName("com.mysql.cj.jdbc.Driver");
        try (Connection ignored = connection()) { System.out.println("Connected to TiDB database: " + DB_NAME); }
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", PORT), 0);
        server.createContext("/api/", MediStockServer::handle);
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();
        System.out.println("MediStock API running on port " + PORT);
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) value = DOTENV.get(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static Map<String, String> loadDotEnv() {
        java.nio.file.Path current = java.nio.file.Paths.get(".env").toAbsolutePath().normalize();
        java.nio.file.Path parent = current.getParent() == null ? current
            : current.getParent().resolve("..").resolve(".env").normalize();
        java.nio.file.Path envFile = java.nio.file.Files.isRegularFile(current) ? current
                : java.nio.file.Files.isRegularFile(parent) ? parent : null;
        if (envFile == null) return Collections.emptyMap();

        Map<String, String> values = new HashMap<>();
        try {
            for (String line : java.nio.file.Files.readAllLines(envFile, StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                int separator = trimmed.indexOf('=');
                if (separator <= 0) continue;
                String key = trimmed.substring(0, separator).trim().replace("\uFEFF", "");
                String value = trimmed.substring(separator + 1).trim();
                if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'"))))
                    value = value.substring(1, value.length() - 1);
                if (!key.isEmpty()) values.put(key, value);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Could not read local .env file", e);
        }
        return Collections.unmodifiableMap(values);
    }

    private static Set<String> parseOrigins(String origins) {
        Set<String> values = new HashSet<>();
        for (String origin : origins.split(",")) {
            if (!origin.isBlank()) values.add(origin.trim());
        }
        return values;
    }

    private static Connection connection() throws SQLException {
        String url = "jdbc:mysql://" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME
                + "?sslMode=VERIFY_IDENTITY&enabledTLSProtocols=TLSv1.2,TLSv1.3&serverTimezone=UTC";
        return DriverManager.getConnection(url, DB_USER, DB_PASSWORD);
    }

    private static void handle(HttpExchange ex) throws IOException {
        cors(ex);
        if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) { ex.sendResponseHeaders(204, -1); return; }
        String path = ex.getRequestURI().getPath();
        String method = ex.getRequestMethod();
        try {
            if (path.equals("/api/health") && method.equals("GET")) send(ex, 200, "{\"status\":\"ok\"}");
            else if (path.equals("/api/register") && method.equals("POST")) register(ex);
            else if (path.equals("/api/login") && method.equals("POST")) login(ex);
            else if (path.startsWith("/api/medicines/") || path.equals("/api/medicines")) {
                if (!isAuthenticated(ex)) { send(ex, 401, jsonMessage("Please log in to manage inventory")); return; }
                if (path.equals("/api/medicines") && method.equals("GET")) listMedicines(ex);
                else if (path.equals("/api/medicines") && method.equals("POST")) addMedicine(ex);
                else if (path.equals("/api/medicines/update-quantity") && method.equals("POST")) updateQuantity(ex);
                else if (path.equals("/api/medicines/delete") && method.equals("POST")) deleteMedicine(ex);
                else send(ex, 404, jsonMessage("Endpoint not found"));
            }
            else send(ex, 404, jsonMessage("Endpoint not found"));
        } catch (SQLIntegrityConstraintViolationException e) {
            send(ex, 409, jsonMessage("Username, email or medicine ID already exists"));
        } catch (IllegalArgumentException e) {
            send(ex, 400, jsonMessage(e.getMessage()));
        } catch (SQLException e) {
            e.printStackTrace();
            send(ex, 500, jsonMessage("Database operation failed. Check backend logs and TiDB connection settings."));
        } catch (Exception e) {
            e.printStackTrace();
            send(ex, 500, jsonMessage("Server error"));
        }
    }

    private static void register(HttpExchange ex) throws Exception {
        Map<String, String> p = params(ex);
        String username = required(p, "username"), email = required(p, "email"), password = required(p, "password");
        if (password.length() < 8) throw new IllegalArgumentException("Password must contain at least 8 characters");
        String salt = randomSalt();
        String hash = passwordHash(password, salt);
        try (Connection c = connection(); PreparedStatement s = c.prepareStatement(
                "INSERT INTO users(username,email,password_salt,password_hash) VALUES(?,?,?,?)")) {
            s.setString(1, username); s.setString(2, email); s.setString(3, salt); s.setString(4, hash);
            s.executeUpdate();
        }
        send(ex, 201, jsonMessage("Registration successful"));
    }

    private static void login(HttpExchange ex) throws Exception {
        Map<String, String> p = params(ex);
        String username = required(p, "username"), password = required(p, "password");
        try (Connection c = connection(); PreparedStatement s = c.prepareStatement(
                "SELECT id,username,password_salt,password_hash FROM users WHERE username=?")) {
            s.setString(1, username);
            try (ResultSet r = s.executeQuery()) {
                if (!r.next() || !passwordHash(password, r.getString("password_salt")).equals(r.getString("password_hash"))) {
                    send(ex, 401, jsonMessage("Invalid username or password")); return;
                }
                byte[] tokenBytes = new byte[32];
                new SecureRandom().nextBytes(tokenBytes);
                String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
                SESSIONS.put(token, System.currentTimeMillis() + SESSION_TTL_MILLIS);
                send(ex, 200, "{\"message\":\"Login successful\",\"token\":\"" + token + "\",\"user\":{\"id\":" + r.getInt("id")
                        + ",\"username\":\"" + jsonEscape(r.getString("username")) + "\"}}");
            }
        }
    }

    private static void listMedicines(HttpExchange ex) throws Exception {
        StringBuilder out = new StringBuilder("[");
        try (Connection c = connection(); PreparedStatement s = c.prepareStatement(
                "SELECT id,name,medicine_code,quantity,unit_price,expiry_date FROM medicines ORDER BY id");
             ResultSet r = s.executeQuery()) {
            boolean first = true;
            while (r.next()) {
                if (!first) out.append(','); first = false;
                out.append("{\"id\":").append(r.getInt("id"))
                   .append(",\"name\":\"").append(jsonEscape(r.getString("name"))).append('\"')
                   .append(",\"medicineCode\":\"").append(jsonEscape(r.getString("medicine_code"))).append('\"')
                   .append(",\"quantity\":").append(r.getInt("quantity"))
                   .append(",\"unitPrice\":").append(r.getBigDecimal("unit_price"))
                   .append(",\"expiryDate\":\"").append(r.getDate("expiry_date")).append("\"}");
            }
        }
        out.append(']'); send(ex, 200, out.toString());
    }

    private static void addMedicine(HttpExchange ex) throws Exception {
        Map<String, String> p = params(ex);
        String name = required(p, "name"), code = required(p, "medicineCode");
        int quantity = Integer.parseInt(required(p, "quantity"));
        java.math.BigDecimal price = new java.math.BigDecimal(required(p, "unitPrice"));
        java.sql.Date expiry = java.sql.Date.valueOf(required(p, "expiryDate"));
        if (quantity < 0 || price.signum() < 0) throw new IllegalArgumentException("Quantity and price cannot be negative");
        try (Connection c = connection(); PreparedStatement s = c.prepareStatement(
                "INSERT INTO medicines(name,medicine_code,quantity,unit_price,expiry_date) VALUES(?,?,?,?,?)")) {
            s.setString(1, name); s.setString(2, code); s.setInt(3, quantity); s.setBigDecimal(4, price); s.setDate(5, expiry);
            s.executeUpdate();
        }
        send(ex, 201, jsonMessage("Medicine added successfully"));
    }

    private static void updateQuantity(HttpExchange ex) throws Exception {
        Map<String, String> p = params(ex);
        int id = Integer.parseInt(required(p, "id")), quantity = Integer.parseInt(required(p, "quantity"));
        if (quantity < 0) throw new IllegalArgumentException("Quantity cannot be negative");
        try (Connection c = connection(); PreparedStatement s = c.prepareStatement("UPDATE medicines SET quantity=? WHERE id=?")) {
            s.setInt(1, quantity); s.setInt(2, id);
            if (s.executeUpdate() == 0) { send(ex, 404, jsonMessage("Medicine not found")); return; }
        }
        send(ex, 200, jsonMessage("Quantity updated successfully"));
    }

    private static void deleteMedicine(HttpExchange ex) throws Exception {
        int id = Integer.parseInt(required(params(ex), "id"));
        try (Connection c = connection(); PreparedStatement s = c.prepareStatement("DELETE FROM medicines WHERE id=?")) {
            s.setInt(1, id);
            if (s.executeUpdate() == 0) { send(ex, 404, jsonMessage("Medicine not found")); return; }
        }
        send(ex, 200, jsonMessage("Medicine deleted successfully"));
    }

    private static Map<String, String> params(HttpExchange ex) throws IOException {
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, String> values = new HashMap<>();
        for (String pair : body.split("&")) {
            if (pair.isEmpty()) continue;
            String[] kv = pair.split("=", 2);
            values.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                    kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "");
        }
        return values;
    }
    private static String required(Map<String, String> p, String key) {
        String value = p.get(key);
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(key + " is required");
        return value.trim();
    }
    private static String randomSalt() {
        byte[] salt = new byte[16]; new SecureRandom().nextBytes(salt); return Base64.getEncoder().encodeToString(salt);
    }
    private static String passwordHash(String password, String salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), Base64.getDecoder().decode(salt), 120000, 256);
        try {
            byte[] bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return Base64.getEncoder().encodeToString(bytes);
        } finally { spec.clearPassword(); }
    }
    private static String jsonMessage(String message) { return "{\"message\":\"" + jsonEscape(message) + "\"}"; }

    private static boolean isAuthenticated(HttpExchange ex) {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return false;
        String token = header.substring(7).trim();
        Long expiresAt = SESSIONS.get(token);
        if (expiresAt == null) return false;
        if (expiresAt <= System.currentTimeMillis()) {
            SESSIONS.remove(token);
            return false;
        }
        return true;
    }

    private static String jsonEscape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
    private static void cors(HttpExchange ex) {
        String origin = ex.getRequestHeaders().getFirst("Origin");
        if (origin != null && ALLOWED_ORIGINS.contains(origin.trim()))
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
        ex.getResponseHeaders().set("Vary", "Origin");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    private static void send(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(bytes); }
    }
}
