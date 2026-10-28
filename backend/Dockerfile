FROM maven:3.9.12-eclipse-temurin-21@sha256:c3c9d3ac4ce8431a3995c0318b8d390f448e693dd4fabc16e9b68d2e1f3d7b46 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine@sha256:51ab5e3302e7141ce665ca3ea85e8b5cd648eafbc3c0c90dd79d6537684e4555 AS runtime
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=build --chown=spring:spring /workspace/target/nexo-commerce-backend-0.1.0-SNAPSHOT.jar ./app.jar
USER spring
EXPOSE 8080 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
