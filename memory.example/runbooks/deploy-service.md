# Deploy Service

This is a future write action and requires explicit confirmation.

Document service-specific deploy scripts locally in `memory/runbooks/deploy-service.md`.

Generic post-deploy checks:

1. Check Compose service status.
2. Check logs for recent errors.
3. Check HTTP health endpoint.
4. Write a short deployment summary.
