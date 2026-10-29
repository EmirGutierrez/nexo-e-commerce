-- Legacy opaque mobile access tokens cannot be validated as signed JWTs.
-- Invalidate active mobile sessions during the JWT authentication rollout.
DELETE FROM mobile_access_token;
