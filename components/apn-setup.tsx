/**
 * APN (Access Point Name) setup instructions — shared across the signup
 * confirmation, customer account page, and the admin CSR quick-reference.
 *
 * The APN name is configurable via NEXT_PUBLIC_APN_NAME (default "mobilitynet")
 * so it can be overridden without a code change. Styled with theme tokens so it
 * renders correctly in both the dark customer theme and the light admin panel.
 */

export const APN_NAME = process.env.NEXT_PUBLIC_APN_NAME || "mobilitynet";

const codeClass = "rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground";

export function ApnSetup() {
  return (
    <div className="space-y-3 text-left text-sm text-muted-foreground">
      <p>After installing your eSIM, configure your data connection:</p>
      <div className="space-y-1">
        <p className="font-medium text-foreground">iPhone</p>
        <p>
          Settings → Cellular → [MobilityNet line] → Cellular Data Network → APN:{" "}
          <code className={codeClass}>{APN_NAME}</code>
        </p>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">Android</p>
        <p>
          Settings → Network → Mobile Networks → Access Point Names → Add → APN:{" "}
          <code className={codeClass}>{APN_NAME}</code>
        </p>
      </div>
      <p>No username or password required.</p>
    </div>
  );
}
