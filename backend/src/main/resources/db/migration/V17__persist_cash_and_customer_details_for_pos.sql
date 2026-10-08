ALTER TABLE in_person_sales
    ADD COLUMN customer_name VARCHAR(160),
    ADD COLUMN customer_nit VARCHAR(20),
    ADD COLUMN cash_received NUMERIC(14, 2),
    ADD COLUMN cash_change NUMERIC(14, 2);

ALTER TABLE in_person_sales
    DROP CONSTRAINT in_person_sales_payment_method_allowed,
    ADD CONSTRAINT in_person_sales_payment_method_allowed
        CHECK (payment_method IN ('cash', 'card', 'transfer')),
    ADD CONSTRAINT in_person_sales_cash_values_nonnegative
        CHECK ((cash_received IS NULL OR cash_received >= 0) AND (cash_change IS NULL OR cash_change >= 0)),
    ADD CONSTRAINT in_person_sales_cash_payment_complete
        CHECK (payment_method <> 'cash' OR (cash_received IS NOT NULL AND cash_change IS NOT NULL
            AND cash_received >= total AND cash_received - total = cash_change));

CREATE INDEX in_person_sales_customer_nit_idx ON in_person_sales (customer_nit)
    WHERE customer_nit IS NOT NULL;
