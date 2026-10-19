package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;

class BusinessEmailServiceTest {
    private static final BusinessEmailService.EmailRequested EVENT =
            new BusinessEmailService.EmailRequested("cliente@example.test", "Comprobante", "Gracias por tu compra.");

    @Test
    void sendsPlainTextEmailAfterCommitWhenTransportIsConfigured() throws Exception {
        ObjectProvider<JavaMailSender> providers = mock(ObjectProvider.class);
        JavaMailSender sender = mock(JavaMailSender.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(providers.getIfAvailable()).thenReturn(sender);
        when(sender.createMimeMessage()).thenReturn(message);
        BusinessEmailService service = new BusinessEmailService(providers, "ventas@nexo.example");

        service.deliver(EVENT);

        verify(sender).send(message);
        assertEquals("ventas@nexo.example", message.getFrom()[0].toString());
        assertEquals("cliente@example.test", message.getRecipients(Message.RecipientType.TO)[0].toString());
        assertEquals("Comprobante", message.getSubject());
        assertEquals("Gracias por tu compra.", message.getContent());
    }

    @Test
    void skipsDeliveryWhenTransportOrSenderAddressIsMissing() {
        ObjectProvider<JavaMailSender> noProviders = mock(ObjectProvider.class);
        when(noProviders.getIfAvailable()).thenReturn(null);
        new BusinessEmailService(noProviders, "ventas@nexo.example").deliver(EVENT);

        ObjectProvider<JavaMailSender> providers = mock(ObjectProvider.class);
        JavaMailSender sender = mock(JavaMailSender.class);
        when(providers.getIfAvailable()).thenReturn(sender);
        new BusinessEmailService(providers, " ").deliver(EVENT);

        verifyNoInteractions(sender);
    }

    @Test
    void containsTransportFailuresSoACommittedSaleIsNotRolledBack() {
        ObjectProvider<JavaMailSender> providers = mock(ObjectProvider.class);
        JavaMailSender sender = mock(JavaMailSender.class);
        when(providers.getIfAvailable()).thenReturn(sender);
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        org.mockito.Mockito.doThrow(new IllegalStateException("SMTP unavailable")).when(sender)
                .send(org.mockito.ArgumentMatchers.any(MimeMessage.class));

        assertDoesNotThrow(() -> new BusinessEmailService(providers, "ventas@nexo.example").deliver(EVENT));
    }
}
