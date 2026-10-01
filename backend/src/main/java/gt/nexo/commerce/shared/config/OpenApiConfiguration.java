package gt.nexo.commerce.shared.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@OpenAPIDefinition(info = @Info(
        title = "NEXO Commerce API",
        version = "v1",
        description = "API modular para la operación de NEXO Commerce."))
@SecurityScheme(
    name = "sessionCookie",
        type = SecuritySchemeType.APIKEY,
        in = SecuritySchemeIn.COOKIE,
    paramName = "NEXOSESSION",
    description = "Sesión HttpOnly administrada por Spring.")
@SecurityScheme(
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "Opaque access token",
        description = "Token móvil de vida limitada, revocable en el servidor.")
public class OpenApiConfiguration {
}
