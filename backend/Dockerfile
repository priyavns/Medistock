FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/medistock-api-1.0.0.jar /app/medistock-api.jar
EXPOSE 8080
CMD ["java", "-jar", "/app/medistock-api.jar"]
