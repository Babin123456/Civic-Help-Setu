/**
 * Multi-Modal Civic Accessibility Swarm: Synthetic Test Fixtures (#1177)
 * Strictly synthetic data - zero real citizen PII or production records.
 */

export const SYNTHETIC_CLEAN_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ration Card Application - Civic Help Setu</title>
</head>
<body>
  <header>
    <h1>Civic Help Setu Ration Portal</h1>
    <nav aria-label="Main Navigation">
      <a href="/home" style="display:inline-block; min-width:48px; min-height:48px;">Home</a>
      <a href="/status" style="display:inline-block; min-width:48px; min-height:48px;">Status</a>
    </nav>
  </header>
  <main>
    <section>
      <h2>Family Member Details</h2>
      <p style="color: #2b2b2b;">Please enter the applicant details to check eligibility.</p>
      <form>
        <label for="applicantName">Applicant Full Name</label>
        <input id="applicantName" type="text" style="min-height: 48px;" />
        <button type="submit" style="min-height: 48px; min-width: 96px; background: #004d40; color: #ffffff;">Submit</button>
      </form>
      <img src="/assets/emblem.png" alt="State Government Emblem" width="60" height="60" />
    </section>
  </main>
</body>
</html>
`;

export const SYNTHETIC_ACCESSIBILITY_DEFECTS_PAGE = `
<html>
<head>
  <!-- Missing viewport and zoom disabled -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Pension Scheme Form</title>
</head>
<body>
  <div>
    <!-- Interactive non-focusable div lacking role="button" and tabindex -->
    <div onclick="submitPensionForm()" style="color: #999999; width: 30px; height: 30px;">
      Click here to submit
    </div>

    <!-- Missing alt text on informative image -->
    <img src="/static/qr_code_pay.png" />

    <!-- Unlabeled input controls -->
    <input type="text" placeholder="Enter Aadhaar Number" />

    <!-- Positive tabindex breaking focus order -->
    <a href="/terms" tabindex="5">Terms & Conditions</a>

    <!-- Bureaucratic jargon in public citizen instructions -->
    <p style="color: #aaaaaa;">
      The applicant must submit the affidavit, inter alia, declaring that heretofore all pensions have been surrendered mutatis mutandis.
    </p>

    <!-- Outlines suppressed -->
    <style>
      button { outline: none; }
    </style>
    <button style="width: 25px; height: 25px;">Go</button>
  </div>
</body>
</html>
`;

export const SYNTHETIC_PII_CONTAMINATED_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Citizen Verification Preview</title>
</head>
<body>
  <h1>Citizen Details</h1>
  <p>Beneficiary Aadhaar: 9876 5432 1098</p>
  <p>Beneficiary PAN: ABCDE1234F</p>
  <p>Phone: 9876543210</p>
  <p>Email: applicant.citizen@example.gov.in</p>
</body>
</html>
`;
