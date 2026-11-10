import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-slate-800">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">
          Privacy Notice & Personal Data Protection
        </h1>
        <p className="text-sm text-slate-500 mb-8">
          Last Updated: November 2026 · Digital Personal Data Protection (DPDP) Act, 2023 Disclosure
        </p>

        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Data Collected</h2>
            <p className="text-slate-600 leading-relaxed">
              VolunteerHub collects and processes personal information strictly necessary for staffing paid volunteer events in Bengaluru:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-slate-600">
              <li><strong>Personal Identifiers:</strong> Full Name and 10-digit Indian Mobile Phone Number.</li>
              <li><strong>Financial Information:</strong> UPI ID (encrypted at rest via AES-256-GCM).</li>
              <li><strong>Operational Records:</strong> Event attendance, shift check-ins, and earnings payouts.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Purpose of Collection</h2>
            <p className="text-slate-600 leading-relaxed">
              Data is collected solely to authenticate volunteers, prevent double-booking conflicts, send automated 24-hour shift reminders, confirm event check-in, and calculate verified earnings.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Access & Data Sharing</h2>
            <p className="text-slate-600 leading-relaxed">
              We never sell, rent, or share personal data with external third parties. Volunteer phone numbers and full UPI IDs are restricted strictly to authorized club administrators who disburse event payments.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Rights to Correction and Erasure</h2>
            <p className="text-slate-600 leading-relaxed">
              Under India’s Digital Personal Data Protection Act (DPDP), 2023, data principals have the right to review, rectify, or request erasure of their personal data. To delete your account or anonymize your personal records, contact your club admin or submit a request directly through the admin portal.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Notice:</strong> India's Digital Personal Data Protection Act, 2023 applies to digital personal data processed within the territory of India. The operator should review legal obligations with a qualified professional before wider commercial launch. This notice is provided for informational and compliance transparency purposes and does not constitute formal legal advice.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

