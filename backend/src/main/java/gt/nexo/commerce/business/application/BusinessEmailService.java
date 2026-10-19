package gt.nexo.commerce.business.application;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class BusinessEmailService {
    private static final Logger log = LoggerFactory.getLogger(BusinessEmailService.class);

    private final ObjectProvider<JavaMailSender> mailSenders;
    private final String from;

    public BusinessEmailService(ObjectProvider<JavaMailSender> mailSenders,
                                @Value("${spring.mail.from:${spring.mail.username:}}") String from) {
        this.mailSenders = mailSenders;
        this.from = from;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void deliver(EmailRequested event) {
        JavaMailSender sender = mailSenders.getIfAvailable();
        if (sender == null || from.isBlank()) {
            log.warn("Correo no enviado a {} porque falta configurar el transporte SMTP y MAIL_FROM.", event.recipient());
            return;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from);
            helper.setTo(event.recipient());
            helper.setSubject(event.subject());
            helper.setText(event.body(), false);
            sender.send(message);
        } catch (MessagingException | RuntimeException exception) {
            log.error("No se pudo enviar el correo de negocio a {}.", event.recipient(), exception);
        }
    }

    public record EmailRequested(String recipient, String subject, String body) { }
}
