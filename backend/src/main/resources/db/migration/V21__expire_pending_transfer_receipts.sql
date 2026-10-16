ALTER TABLE transfer_receipts DROP CONSTRAINT transfer_receipts_status_allowed;

ALTER TABLE transfer_receipts
    ADD CONSTRAINT transfer_receipts_status_allowed
        CHECK (status IN ('Pendiente', 'Aprobada', 'Rechazada', 'Expirada'));
