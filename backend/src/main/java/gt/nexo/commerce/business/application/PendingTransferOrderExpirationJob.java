package gt.nexo.commerce.business.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PendingTransferOrderExpirationJob {
    private static final Logger log = LoggerFactory.getLogger(PendingTransferOrderExpirationJob.class);

    private final BusinessRecordService records;

    public PendingTransferOrderExpirationJob(BusinessRecordService records) {
        this.records = records;
    }

    @Scheduled(fixedDelayString = "${nexo.orders.transfer-expiration-scan-interval:PT5M}",
            initialDelayString = "${nexo.orders.transfer-expiration-initial-delay:PT1M}")
    public void expirePendingTransferOrders() {
        int expired = records.expirePendingTransferOrders();
        if (expired > 0) log.info("Expired {} pending transfer order reservations", expired);
    }
}
