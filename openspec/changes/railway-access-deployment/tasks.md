## 1. Production implementation
- [x] 1.1 Add the authenticated production server, restricted CORE proxy, drafting integration, and Railway configuration.
- [x] 1.2 Verify signed-token allow/deny behavior, route protection, proxy behavior, and production builds; validate OpenSpec.

## 2. Deployment
- [x] 2.1 Configure Cloudflare Access for the configured email domains and individual addresses with one-time PIN login.
- [x] 2.2 Deploy the current app to Railway with server-side credentials and configure scipris.intrepidata.io DNS.
- [x] 2.3 Verify deployed health, login protection, and origin rejection; document operations and verification limits.
- [x] 2.4 Authorize Railway GitHub repository access and enable the main deployment trigger.
- [x] 2.5 Verify a push deploys its exact commit successfully. Commit `26690d3` automatically produced successful Railway deployment `e1716f8e-15e1-4172-8c5e-293f7c2c5386`.
