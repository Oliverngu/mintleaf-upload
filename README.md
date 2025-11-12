# Mintleaf Backend Setup (Firebase & Resend)

This document outlines the setup for the email backend service, which runs on Firebase Cloud Functions (Gen 2) and uses Resend for email delivery.

## Prerequisites

- **Firebase Project**: `mintleaf-74d27` with the **Blaze (Pay-as-you-go)** billing plan enabled.
- **SDKs**: Latest versions of [Firebase CLI](https://firebase.google.com/docs/cli) and [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) are authenticated.
- **Resend Account**: A configured Resend account with a verified sending domain and a live API key.

## 1. Configure Secrets

The functions require API keys stored securely in Firebase Secret Manager. These commands must be run to set the required secrets for the `mintleaf-74d27` project.

```bash
# Set the Resend API Key (e.g., re_****************)
firebase functions:secrets:set RESEND_API_KEY --project=mintleaf-74d27

# Set the default "From" email address (e.g., MintLeaf <noreply@mintleaf.hu>)
firebase functions:secrets:set RESEND_FROM_DEFAULT --project=mintleaf-74d27
```

> **Note:** The `from` address must use a domain verified with Resend.

## 2. Seed Initial Data

The Email Admin feature requires some initial documents in Firestore to function correctly. A seed script is provided to create these.

```bash
# From the project root, run the seed script
node scripts/seedEmailConfig.mjs
```
This will create the `appFlags/email` document (with `writeEnabled: false`) and placeholder documents in the `emailConfigs` collection.

## 3. Deploy & Verify

The functions are located in the `backend/` directory and are deployed to the `europe-central2` region.

### Deployment

```bash
# Deploy all functions from the project root
firebase deploy --only functions --project=mintleaf-74d27
```

This will deploy two functions: `resendHealth` and `admin`.

### Verification

1.  **Get the `admin` function URL**:
    ```bash
    gcloud functions describe admin \
      --region=europe-central2 --gen2 \
      --project mintleaf-74d27 \
      --format='value(serviceConfig.uri)'
    ```
    This URL should be set as `BASE_URL` in `src/core/api/emailAdminService.ts`.

2.  **Test in the App**: Navigate to the "Adminisztráció" -> "Email Beállítások" tab in the web application. You should see the UI load the default configurations in read-only mode.

## Next Steps: Enabling Write Access

The system is in a "safe" read-only mode by default. To enable saving changes and sending real test emails:

1.  Go to your Firestore database in the Firebase Console.
2.  Navigate to the `appFlags` collection.
3.  Open the `email` document.
4.  Change the value of the `writeEnabled` field from `false` to `true`.

The UI will automatically detect this change and enable the "Save" and "Send Test" functionalities.
