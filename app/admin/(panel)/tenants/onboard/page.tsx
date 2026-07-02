"use client";

/**
 * MVNE tenant onboarding wizard (super_admin only).
 *
 * A six-step guided flow that walks a new MVNE partner from first details
 * through activation. The tenant record is created at the end of step 1 (POST
 * /admin/tenants); every subsequent "Next" auto-saves progress with a full
 * PATCH /admin/tenants/:id, so navigating back and forth never loses data.
 *
 * Field → tenant mapping:
 *   name                → tenant.name (column)
 *   slug                → tenant.slug (column, create-only)
 *   custom domain       → tenant.domain (column)
 *   roaming profile     → tenant.roaming_profile_id (column)
 *   contact/contract/carrier/CSR → tenant.billing_config (JSONB)
 *   brand + markets     → tenant.brand_config (JSONB)
 *   plan catalog        → tenant.plans (JSONB array)
 *
 * Pass ?id=<tenant> to resume/edit an in-flight onboarding.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  activateTenant,
  createTenant,
  getTenant,
  updateTenant,
  type Tenant,
} from "@/lib/admin-api";
import { getAdminRole } from "@/lib/admin-auth";
import { ApiError } from "@/lib/api";

// --- Constants ----------------------------------------------------------

const STEPS = [
  "Partner Details",
  "Brand & Identity",
  "Service Configuration",
  "Plan Catalog",
  "Market Selection",
  "Review & Activate",
] as const;

const CONTRACT_TIERS = [
  { value: "starter", label: "Starter", price: "$3.50 / sub" },
  { value: "managed", label: "Managed", price: "$15 / sub" },
  { value: "enterprise", label: "Enterprise", price: "Custom" },
];

const CONTRACT_TERMS = [
  { value: "12_month", label: "12-month" },
  { value: "24_month", label: "24-month" },
  { value: "month_to_month", label: "Month-to-month" },
];

const CARRIER_PROFILES = [
  { value: "single_att", label: "Single — AT&T", price: "$3.50 / sub" },
  { value: "dual_att_tmo", label: "Dual — AT&T + T-Mobile", price: "$4.00 / sub" },
  { value: "triple", label: "Triple", price: "$4.50 / sub" },
];

const OVERAGE_BEHAVIORS = [
  { value: "throttle", label: "Throttle" },
  { value: "charge", label: "Charge" },
  { value: "hard_cap", label: "Hard cap" },
];

// DECISION: MobilityNet is the flagship $25 unlimited product. Exact tiers
// weren't specified, so these three are reasonable starter defaults the operator
// edits before saving. data_cap_gb = 0 means unlimited.
const MOBILITYNET_DEFAULT_PLANS: PlanRow[] = [
  {
    name: "Unlimited Talk, Text & Data",
    monthly_price: "25",
    data_cap_gb: "0",
    overage_behavior: "throttle",
    overage_rate: "0",
  },
  {
    name: "Value 10GB",
    monthly_price: "20",
    data_cap_gb: "10",
    overage_behavior: "throttle",
    overage_rate: "0",
  },
  {
    name: "Basic 3GB",
    monthly_price: "15",
    data_cap_gb: "3",
    overage_behavior: "charge",
    overage_rate: "5",
  },
];

const ONBOARDING_CHECKLIST = [
  "Provision the Acrobits Cloud ID and publish the white-label dialer app",
  "Submit the branded app to the Apple App Store and Google Play",
  "Configure DNS for the custom domain and issue TLS certificates",
  "Purchase and assign DIDs per market in Telnyx (manual for now)",
];

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type OverageBehavior = "throttle" | "charge" | "hard_cap";

interface PlanRow {
  name: string;
  monthly_price: string;
  data_cap_gb: string;
  overage_behavior: OverageBehavior;
  overage_rate: string;
}

// --- Helpers ------------------------------------------------------------

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function num(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

// --- Page shell ---------------------------------------------------------

export default function OnboardTenantPage() {
  return (
    <Suspense fallback={null}>
      <OnboardGate />
    </Suspense>
  );
}

function OnboardGate() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  useEffect(() => setRole(getAdminRole()), []);

  if (role === undefined) return null;
  if (role !== "super_admin") {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold">Onboard Tenant</h1>
        </header>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Only super admins can onboard tenants.
        </p>
      </div>
    );
  }
  return <OnboardWizard />;
}

// --- Wizard -------------------------------------------------------------

function OnboardWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>(0);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [status, setStatus] = useState<Tenant["status"] | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Step 1 — Partner Details
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contractTier, setContractTier] = useState("starter");
  const [contractTerm, setContractTerm] = useState("12_month");
  const [setupFeeCollected, setSetupFeeCollected] = useState(false);

  // Step 2 — Brand & Identity
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [logoUrl, setLogoUrl] = useState("");
  const [appName, setAppName] = useState("");

  // Step 3 — Service Configuration
  const [carrierProfile, setCarrierProfile] = useState("single_att");
  const [roamingProfileId, setRoamingProfileId] = useState("19855");
  const [csrAddon, setCsrAddon] = useState(false);
  const [customDomain, setCustomDomain] = useState("");

  // Step 4 — Plan Catalog
  const [plans, setPlans] = useState<PlanRow[]>(MOBILITYNET_DEFAULT_PLANS);

  // Step 5 — Market Selection
  const [areaCodes, setAreaCodes] = useState("");
  const [didsPerMarket, setDidsPerMarket] = useState("10");

  // Resume/edit an existing tenant when ?id= is present.
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) {
      setLoadingExisting(false);
      return;
    }
    let cancelled = false;
    getTenant(id)
      .then((t) => {
        if (cancelled) return;
        prefillFromTenant(t);
        setTenantId(t.id);
        setStatus(t.status);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load tenant.");
        }
      })
      .finally(() => !cancelled && setLoadingExisting(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function prefillFromTenant(t: Tenant) {
    const bc = (t.billing_config ?? {}) as Record<string, unknown>;
    const brand = (t.brand_config ?? {}) as Record<string, unknown>;
    const markets = (brand.markets ?? {}) as Record<string, unknown>;

    setBusinessName(t.name ?? "");
    setSlug(t.slug ?? "");
    setSlugTouched(true);
    setContactName(str(bc.contact_name));
    setContactEmail(str(bc.contact_email));
    setContractTier(str(bc.contract_tier) || "starter");
    setContractTerm(str(bc.contract_term) || "12_month");
    setSetupFeeCollected(Boolean(bc.setup_fee_collected));

    setBrandName(str(brand.brand_name));
    setPrimaryColor(str(brand.primary_color) || "#2563eb");
    setSecondaryColor(str(brand.secondary_color) || "#0f172a");
    setLogoUrl(str(brand.logo_url));
    setAppName(str(brand.app_name));

    setCarrierProfile(str(bc.carrier_profile) || "single_att");
    setRoamingProfileId(t.roaming_profile_id ?? "19855");
    setCsrAddon(Boolean(bc.csr_addon));
    setCustomDomain(t.domain ?? "");

    if (Array.isArray(t.plans) && t.plans.length) {
      setPlans(
        (t.plans as Record<string, unknown>[]).map((p) => ({
          name: str(p.name),
          monthly_price: str(p.monthly_price),
          data_cap_gb: str(p.data_cap_gb),
          overage_behavior: (str(p.overage_behavior) || "throttle") as OverageBehavior,
          overage_rate: str(p.overage_rate),
        })),
      );
    }

    const codes = markets.area_codes;
    setAreaCodes(Array.isArray(codes) ? codes.join(", ") : str(codes));
    if (markets.dids_per_market != null) setDidsPerMarket(str(markets.dids_per_market));
  }

  // --- Derived payloads -------------------------------------------------

  function buildBillingConfig(): Record<string, unknown> {
    return {
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      contract_tier: contractTier,
      contract_term: contractTerm,
      setup_fee_collected: setupFeeCollected,
      carrier_profile: carrierProfile,
      csr_addon: csrAddon,
    };
  }

  function buildBrandConfig(): Record<string, unknown> {
    return {
      brand_name: brandName.trim(),
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      logo_url: logoUrl.trim(),
      app_name: appName.trim(),
      markets: {
        area_codes: areaCodes
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        dids_per_market: Math.max(0, Math.round(num(didsPerMarket))),
      },
    };
  }

  function buildPlans() {
    return plans
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        monthly_price: num(p.monthly_price),
        data_cap_gb: num(p.data_cap_gb),
        overage_behavior: p.overage_behavior,
        overage_rate: num(p.overage_rate),
      }));
  }

  function fullPatch(): Partial<Tenant> {
    return {
      name: businessName.trim(),
      domain: customDomain.trim() || null,
      roaming_profile_id: roamingProfileId.trim() || null,
      brand_config: buildBrandConfig(),
      billing_config: buildBillingConfig(),
      plans: buildPlans(),
    };
  }

  // --- Persistence ------------------------------------------------------

  /** Create the tenant on first save, then PATCH the full record thereafter. */
  async function persist(): Promise<string> {
    if (!tenantId) {
      const created = await createTenant({
        name: businessName.trim(),
        slug: slug.trim(),
        billing_config: buildBillingConfig(),
      });
      setTenantId(created.id);
      setStatus(created.status);
      return created.id;
    }
    const updated = await updateTenant(tenantId, fullPatch());
    setStatus(updated.status);
    return updated.id;
  }

  function validateStep(current: Step): string | null {
    if (current === 0) {
      if (!businessName.trim()) return "Business name is required.";
      if (!slug.trim()) return "Slug is required.";
      if (contactEmail.trim() && !contactEmail.includes("@")) {
        return "Enter a valid contact email.";
      }
    }
    return null;
  }

  async function handleNext() {
    setError(null);
    setNotice(null);
    const problem = validateStep(step);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await persist();
      setStep((s) => Math.min(5, s + 1) as Step);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save progress.");
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    setError(null);
    setNotice(null);
    setStep((s) => Math.max(0, s - 1) as Step);
  }

  async function handleSaveReview() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await persist();
      setNotice("Tenant saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save tenant.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const id = await persist();
      const activated = await activateTenant(id);
      setStatus(activated.status);
      router.push(`/admin/tenants/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to activate tenant.");
      setSaving(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tenants
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">
          {tenantId ? "Onboard Tenant" : "Onboard New Tenant"}
        </h1>
        <p className="text-sm text-slate-500">
          {businessName.trim() || "Guide a new MVNE partner through setup."}
          {status && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
              {status}
            </span>
          )}
        </p>
      </header>

      <StepBar steps={STEPS as unknown as string[]} current={step} />

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {step === 0 && (
          <StepPartnerDetails
            businessName={businessName}
            setBusinessName={(v) => {
              setBusinessName(v);
              if (!slugTouched) setSlug(slugify(v));
            }}
            slug={slug}
            setSlug={(v) => {
              setSlugTouched(true);
              setSlug(slugify(v));
            }}
            slugLocked={Boolean(tenantId)}
            contactName={contactName}
            setContactName={setContactName}
            contactEmail={contactEmail}
            setContactEmail={setContactEmail}
            contractTier={contractTier}
            setContractTier={setContractTier}
            contractTerm={contractTerm}
            setContractTerm={setContractTerm}
            setupFeeCollected={setupFeeCollected}
            setSetupFeeCollected={setSetupFeeCollected}
          />
        )}

        {step === 1 && (
          <StepBrand
            brandName={brandName}
            setBrandName={setBrandName}
            primaryColor={primaryColor}
            setPrimaryColor={setPrimaryColor}
            secondaryColor={secondaryColor}
            setSecondaryColor={setSecondaryColor}
            logoUrl={logoUrl}
            setLogoUrl={setLogoUrl}
            appName={appName}
            setAppName={setAppName}
          />
        )}

        {step === 2 && (
          <StepService
            carrierProfile={carrierProfile}
            setCarrierProfile={setCarrierProfile}
            roamingProfileId={roamingProfileId}
            setRoamingProfileId={setRoamingProfileId}
            csrAddon={csrAddon}
            setCsrAddon={setCsrAddon}
            customDomain={customDomain}
            setCustomDomain={setCustomDomain}
          />
        )}

        {step === 3 && <StepPlans plans={plans} setPlans={setPlans} />}

        {step === 4 && (
          <StepMarkets
            areaCodes={areaCodes}
            setAreaCodes={setAreaCodes}
            didsPerMarket={didsPerMarket}
            setDidsPerMarket={setDidsPerMarket}
          />
        )}

        {step === 5 && (
          <StepReview
            businessName={businessName}
            slug={slug}
            contactName={contactName}
            contactEmail={contactEmail}
            contractTier={contractTier}
            contractTerm={contractTerm}
            setupFeeCollected={setupFeeCollected}
            brandName={brandName}
            appName={appName}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            logoUrl={logoUrl}
            carrierProfile={carrierProfile}
            roamingProfileId={roamingProfileId}
            csrAddon={csrAddon}
            customDomain={customDomain}
            plans={buildPlans()}
            areaCodes={areaCodes}
            didsPerMarket={didsPerMarket}
            status={status}
          />
        )}

        {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
        {notice && <p className="mt-4 text-sm font-medium text-emerald-600">{notice}</p>}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={handleBack} disabled={saving || step === 0}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step < 5 ? (
            <Button onClick={handleNext} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === 0 && !tenantId ? "Create & Continue" : "Save & Next"}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveReview} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {tenantId ? "Update Tenant" : "Create Tenant"}
              </Button>
              <Button
                onClick={handleActivate}
                disabled={saving || status === "active"}
              >
                <Rocket className="h-4 w-4" />
                {status === "active" ? "Activated" : "Activate"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Step bar (slate/blue, matches admin chrome) ------------------------

function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex w-full items-start">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          <li key={label} className={cn("flex items-start", !last && "flex-1")}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  done && "border-blue-600 bg-blue-600 text-white",
                  active && "border-blue-600 text-blue-600",
                  !done && !active && "border-slate-200 text-slate-400",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "max-w-[6rem] text-center text-xs leading-tight",
                  active ? "font-semibold text-slate-900" : "text-slate-400",
                )}
              >
                {label}
              </span>
            </div>
            {!last && (
              <span
                className={cn(
                  "mx-1 mt-4 h-0.5 flex-1 rounded",
                  done ? "bg-blue-600" : "bg-slate-200",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// --- Steps --------------------------------------------------------------

function StepPartnerDetails(props: {
  businessName: string;
  setBusinessName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  slugLocked: boolean;
  contactName: string;
  setContactName: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  contractTier: string;
  setContractTier: (v: string) => void;
  contractTerm: string;
  setContractTerm: (v: string) => void;
  setupFeeCollected: boolean;
  setSetupFeeCollected: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Partner Details" subtitle="Business identity and contract terms." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Business name"
          value={props.businessName}
          onChange={props.setBusinessName}
          placeholder="FoxFi Mobile"
        />
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            value={props.slug}
            placeholder="foxfi-mobile"
            autoComplete="off"
            disabled={props.slugLocked}
            onChange={(e) => props.setSlug(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            {props.slugLocked
              ? "Slug is fixed once the tenant is created."
              : "Auto-generated from the name. Editable."}
          </p>
        </div>
        <Field
          label="Primary contact name"
          value={props.contactName}
          onChange={props.setContactName}
          placeholder="Jane Doe"
        />
        <Field
          label="Primary contact email"
          value={props.contactEmail}
          onChange={props.setContactEmail}
          placeholder="jane@foxfi-mobile.com"
          type="email"
        />
      </div>

      <OptionCards
        label="Contract tier"
        options={CONTRACT_TIERS}
        value={props.contractTier}
        onChange={props.setContractTier}
      />
      <OptionCards
        label="Contract term"
        options={CONTRACT_TERMS}
        value={props.contractTerm}
        onChange={props.setContractTerm}
      />
      <Toggle
        label="Setup fee collected"
        checked={props.setupFeeCollected}
        onChange={props.setSetupFeeCollected}
      />
    </div>
  );
}

function StepBrand(props: {
  brandName: string;
  setBrandName: (v: string) => void;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  secondaryColor: string;
  setSecondaryColor: (v: string) => void;
  logoUrl: string;
  setLogoUrl: (v: string) => void;
  appName: string;
  setAppName: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Brand & Identity" subtitle="How the app and portal are branded." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Brand name"
          value={props.brandName}
          onChange={props.setBrandName}
          placeholder="FoxFi"
        />
        <Field
          label="App name (App Store)"
          value={props.appName}
          onChange={props.setAppName}
          placeholder="FoxFi Mobile"
        />
        <ColorField
          label="Primary color"
          value={props.primaryColor}
          onChange={props.setPrimaryColor}
        />
        <ColorField
          label="Secondary color"
          value={props.secondaryColor}
          onChange={props.setSecondaryColor}
        />
        <div className="sm:col-span-2">
          <Field
            label="Logo URL"
            value={props.logoUrl}
            onChange={props.setLogoUrl}
            placeholder="https://cdn.foxfi-mobile.com/logo.png"
          />
        </div>
      </div>
    </div>
  );
}

function StepService(props: {
  carrierProfile: string;
  setCarrierProfile: (v: string) => void;
  roamingProfileId: string;
  setRoamingProfileId: (v: string) => void;
  csrAddon: boolean;
  setCsrAddon: (v: boolean) => void;
  customDomain: string;
  setCustomDomain: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="Service Configuration"
        subtitle="Carrier footprint, roaming, and domain."
      />
      <OptionCards
        label="Carrier profile"
        options={CARRIER_PROFILES}
        value={props.carrierProfile}
        onChange={props.setCarrierProfile}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Roaming profile ID"
          value={props.roamingProfileId}
          onChange={props.setRoamingProfileId}
          placeholder="19855"
        />
        <Field
          label="Custom domain"
          value={props.customDomain}
          onChange={props.setCustomDomain}
          placeholder="app.foxfi-mobile.com"
        />
      </div>
      <Toggle
        label="CSR add-on ($5 / sub)"
        checked={props.csrAddon}
        onChange={props.setCsrAddon}
      />
    </div>
  );
}

function StepPlans({
  plans,
  setPlans,
}: {
  plans: PlanRow[];
  setPlans: (v: PlanRow[]) => void;
}) {
  function update(i: number, patch: Partial<PlanRow>) {
    setPlans(plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function remove(i: number) {
    setPlans(plans.filter((_, idx) => idx !== i));
  }
  function add() {
    setPlans([
      ...plans,
      {
        name: "",
        monthly_price: "",
        data_cap_gb: "",
        overage_behavior: "throttle",
        overage_rate: "",
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Plan Catalog"
        subtitle="Plans offered to this tenant's subscribers. Pre-filled with MobilityNet defaults."
      />
      <div className="space-y-4">
        {plans.map((p, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plan {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Plan name"
                value={p.name}
                onChange={(v) => update(i, { name: v })}
                placeholder="Unlimited"
              />
              <Field
                label="Monthly price ($)"
                value={p.monthly_price}
                onChange={(v) => update(i, { monthly_price: v })}
                placeholder="25"
                type="number"
              />
              <Field
                label="Data cap (GB, 0 = unlimited)"
                value={p.data_cap_gb}
                onChange={(v) => update(i, { data_cap_gb: v })}
                placeholder="0"
                type="number"
              />
              <SelectField
                label="Overage behavior"
                value={p.overage_behavior}
                options={OVERAGE_BEHAVIORS}
                onChange={(v) => update(i, { overage_behavior: v as OverageBehavior })}
              />
              <Field
                label="Overage rate ($/GB)"
                value={p.overage_rate}
                onChange={(v) => update(i, { overage_rate: v })}
                placeholder="5"
                type="number"
              />
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" onClick={add}>
        <Plus className="h-4 w-4" />
        Add plan
      </Button>
    </div>
  );
}

function StepMarkets(props: {
  areaCodes: string;
  setAreaCodes: (v: string) => void;
  didsPerMarket: string;
  setDidsPerMarket: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="Market Selection"
        subtitle="Target markets. Informational only — DID purchase is manual via Telnyx."
      />
      <Field
        label="Area codes (comma separated)"
        value={props.areaCodes}
        onChange={props.setAreaCodes}
        placeholder="208, 630, 331"
      />
      <div className="max-w-xs">
        <Field
          label="DIDs to allocate per market"
          value={props.didsPerMarket}
          onChange={props.setDidsPerMarket}
          placeholder="10"
          type="number"
        />
      </div>
    </div>
  );
}

function StepReview(props: {
  businessName: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contractTier: string;
  contractTerm: string;
  setupFeeCollected: boolean;
  brandName: string;
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  carrierProfile: string;
  roamingProfileId: string;
  csrAddon: boolean;
  customDomain: string;
  plans: Record<string, unknown>[];
  areaCodes: string;
  didsPerMarket: string;
  status: Tenant["status"] | null;
}) {
  const tier = CONTRACT_TIERS.find((t) => t.value === props.contractTier)?.label ?? props.contractTier;
  const term = CONTRACT_TERMS.find((t) => t.value === props.contractTerm)?.label ?? props.contractTerm;
  const carrier =
    CARRIER_PROFILES.find((c) => c.value === props.carrierProfile)?.label ?? props.carrierProfile;

  return (
    <div className="space-y-6">
      <SectionTitle title="Review & Activate" subtitle="Confirm everything, then activate." />

      <ReviewGroup title="Partner">
        <ReviewRow label="Business name" value={props.businessName || "—"} />
        <ReviewRow label="Slug" value={props.slug || "—"} mono />
        <ReviewRow label="Contact" value={props.contactName || "—"} />
        <ReviewRow label="Contact email" value={props.contactEmail || "—"} />
        <ReviewRow label="Contract tier" value={tier} />
        <ReviewRow label="Contract term" value={term} />
        <ReviewRow label="Setup fee collected" value={props.setupFeeCollected ? "Yes" : "No"} />
      </ReviewGroup>

      <ReviewGroup title="Brand">
        <ReviewRow label="Brand name" value={props.brandName || "—"} />
        <ReviewRow label="App name" value={props.appName || "—"} />
        <ReviewRow label="Primary color" value={props.primaryColor} swatch={props.primaryColor} />
        <ReviewRow
          label="Secondary color"
          value={props.secondaryColor}
          swatch={props.secondaryColor}
        />
        <ReviewRow label="Logo URL" value={props.logoUrl || "—"} />
      </ReviewGroup>

      <ReviewGroup title="Service">
        <ReviewRow label="Carrier profile" value={carrier} />
        <ReviewRow label="Roaming profile" value={props.roamingProfileId || "—"} mono />
        <ReviewRow label="CSR add-on" value={props.csrAddon ? "Yes" : "No"} />
        <ReviewRow label="Custom domain" value={props.customDomain || "—"} />
      </ReviewGroup>

      <ReviewGroup title={`Plans (${props.plans.length})`}>
        {props.plans.length === 0 ? (
          <p className="text-sm text-slate-400">No plans configured.</p>
        ) : (
          props.plans.map((p, i) => (
            <ReviewRow
              key={i}
              label={String(p.name)}
              value={`$${p.monthly_price} · ${
                Number(p.data_cap_gb) === 0 ? "unlimited" : `${p.data_cap_gb}GB`
              } · ${p.overage_behavior}`}
            />
          ))
        )}
      </ReviewGroup>

      <ReviewGroup title="Markets">
        <ReviewRow label="Area codes" value={props.areaCodes || "—"} />
        <ReviewRow label="DIDs per market" value={props.didsPerMarket || "—"} />
      </ReviewGroup>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="mb-2 text-sm font-semibold text-amber-800">
          Remaining manual steps after activation
        </p>
        <ul className="space-y-1.5">
          {ONBOARDING_CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-amber-800">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-amber-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- Field primitives ---------------------------------------------------

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
          aria-label={`${label} picker`}
        />
        <Input value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function OptionCards({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; price?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className="block text-sm font-medium text-slate-900">{o.label}</span>
              {o.price && <span className="mt-0.5 block text-xs text-slate-500">{o.price}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-slate-400"
      />
      {label}
    </label>
  );
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
  swatch,
}: {
  label: string;
  value: string;
  mono?: boolean;
  swatch?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={cn(
          "flex items-center gap-2 text-right text-slate-900",
          mono && "font-mono text-xs",
        )}
      >
        {swatch && (
          <span
            className="h-4 w-4 rounded border border-slate-200"
            style={{ backgroundColor: swatch }}
          />
        )}
        {value}
      </dd>
    </div>
  );
}
