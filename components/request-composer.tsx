"use client";

import { useMemo, useState, useTransition } from "react";
import {
  assistRequirementAction,
  publishPurchaseRequest,
} from "@/app/actions/mutations";
import {
  formHasUserEnteredData,
  mapRequirementDraftToForm,
  mergeMappedDraft,
} from "@/lib/ai/apply-requirement-draft";
import type { RequirementDraft } from "@/lib/ai/requirement-assistant";
import { arabicPublishError, validatePublishRequest } from "@/lib/request-validation";
import { OTHER_CITY, SAUDI_CITIES, normalizeCitySelection } from "@/lib/saudi-cities";
import { formatDate, formatDateTime } from "@/lib/format";
import { ThemeSelect } from "@/components/theme-select";

const DELIVERY_CITY_OPTIONS = [
  { value: "", label: "اختر المدينة" },
  ...SAUDI_CITIES.map((city) => ({ value: city, label: city })),
  { value: OTHER_CITY, label: OTHER_CITY },
];

export type DraftLineItem = {
  productName: string;
  description: string;
  quantity: number | "";
  unitLabel: string;
  specificationNotes: string;
  acceptedAlternatives: string;
  brandPreference: string;
  minShelfLifeMonths: string;
};

type CategoryOption = { id: string; name: string; slug: string };
type BranchOption = { id: string; name: string; city: string; district: string | null };
type AddressOption = {
  id: string;
  label: string;
  district: string;
  city: string;
  branchId: string;
};

const emptyItem = (): DraftLineItem => ({
  productName: "",
  description: "",
  quantity: "",
  unitLabel: "",
  specificationNotes: "",
  acceptedAlternatives: "",
  brandPreference: "",
  minShelfLifeMonths: "",
});

function addDaysDateInput(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addDaysDateTimeLocal(days: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function RequestComposer({
  categories,
  branches,
  addresses,
}: {
  categories: CategoryOption[];
  branches: BranchOption[];
  addresses: AddressOption[];
}) {
  const packagingCategory =
    categories.find((c) => c.slug === "packaging") ??
    categories.find((c) => c.name.includes("تعبئة") || c.name.includes("تغليف"));
  const otherCategory = categories.find((c) => c.slug === "other");

  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryOtherText, setCategoryOtherText] = useState("");
  const [cityChoice, setCityChoice] = useState("");
  const [otherCity, setOtherCity] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryAddressText, setDeliveryAddressText] = useState("");
  const [branchId, setBranchId] = useState("");
  const [deliveryAddressId, setDeliveryAddressId] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [items, setItems] = useState<DraftLineItem[]>([emptyItem()]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<RequirementDraft | null>(null);
  const [aiEngine, setAiEngine] = useState<string | null>(null);
  const [missingInfo, setMissingInfo] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sampleFilled, setSampleFilled] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const deliveryCity = normalizeCitySelection(cityChoice, otherCity);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isOtherCategory = selectedCategory?.slug === "other";

  const filteredAddresses = useMemo(
    () =>
      addresses.filter((a) => {
        if (branchId && a.branchId !== branchId) return false;
        if (deliveryCity && a.city && a.city !== deliveryCity && cityChoice !== OTHER_CITY) {
          return false;
        }
        return true;
      }),
    [addresses, branchId, deliveryCity, cityChoice],
  );

  const filteredBranches = useMemo(
    () =>
      branches.filter((b) => {
        if (!deliveryCity || cityChoice === OTHER_CITY) return true;
        return !b.city || b.city === deliveryCity;
      }),
    [branches, deliveryCity, cityChoice],
  );

  function updateItem(index: number, patch: Partial<DraftLineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function applyCityFromSource(city: string, district?: string | null) {
    if (!city) return;
    if ((SAUDI_CITIES as readonly string[]).includes(city)) {
      setCityChoice(city);
      setOtherCity("");
    } else {
      setCityChoice(OTHER_CITY);
      setOtherCity(city);
    }
    if (district) setDeliveryDistrict(district);
  }

  function fillSample() {
    const dirty = formHasUserEnteredData({
      title,
      notes,
      deliveryCity: cityChoice,
      deliveryDistrict,
      deliveryAddressText,
      items,
    });
    if (dirty) {
      const ok = window.confirm(
        "النموذج يحتوي على بيانات. هل تريد استبدالها بالنموذج التجريبي؟",
      );
      if (!ok) return;
    }

    const demoBranch =
      branches.find((b) => b.city === "حائل" || b.name.includes("النقرة")) ??
      branches[0];
    const demoAddress = addresses.find((a) => a.branchId === demoBranch?.id);

    setTitle("توريد أكواب قهوة ورقية لفروع حائل");
    setCategoryId(packagingCategory?.id ?? otherCategory?.id ?? "");
    setCategoryOtherText("");
    setCityChoice("حائل");
    setOtherCity("");
    setDeliveryDistrict("النقرة");
    setBranchId(demoBranch?.id ?? "");
    setDeliveryAddressId(demoAddress?.id ?? "");
    setDeliveryAddressText(
      "فرع النقرة، شارع الأمير سعود بن عبدالمحسن، التسليم عند بوابة المستودع.",
    );
    setNeededByDate(addDaysDateInput(10));
    setSubmissionDeadline(addDaysDateTimeLocal(4));
    setNotes("يرجى تقديم عرض شامل للتوصيل، مع توضيح بلد المنشأ والعينة المتاحة.");
    setItems([
      {
        productName: "أكواب قهوة ورقية مزدوجة الجدار سعة 8 أونصات",
        description: "",
        quantity: 10,
        unitLabel: "كرتون",
        specificationNotes:
          "لون أبيض، مناسبة للمشروبات الساخنة، يحتوي الكرتون على 500 كوب، خامة غذائية معتمدة.",
        acceptedAlternatives: "يُقبل مقاس مماثل بشرط توضيح الاختلاف.",
        brandPreference: "",
        minShelfLifeMonths: "",
      },
    ]);
    setRawText("");
    setSampleFilled(true);
    setError(null);
    setFieldErrors({});
    setReviewOpen(false);
    clearAiSuggestion();
  }

  function clearAiSuggestion() {
    setAiDraft(null);
    setAiMessage(null);
    setAiError(null);
    setMissingInfo([]);
    setFollowUps([]);
  }

  function runAi() {
    setAiMessage(null);
    setAiError(null);
    setAiDraft(null);
    setAiEngine(null);
    setMissingInfo([]);
    setFollowUps([]);

    if (!rawText.trim()) {
      setAiError("اكتب وصف احتياجك أولًا قبل التحليل.");
      return;
    }

    startAi(async () => {
      const fd = new FormData();
      fd.set("rawText", rawText);
      const result = await assistRequirementAction(fd);

      if (!result.ok) {
        const diag =
          "diagCode" in result && typeof result.diagCode === "string" && result.diagCode
            ? ` (${result.diagCode})`
            : "";
        setAiError(`${result.message}${diag}`);
        setAiDraft(null);
        return;
      }

      setAiDraft(result.draft);
      setAiEngine(
        result.engine?.provider === "meta-llama"
          ? `Meta Llama · ${result.engine.model.replace(/^@cf\/meta\//, "")}`
          : result.engine
            ? `OpenAI · ${result.engine.model}`
            : null,
      );
      setMissingInfo(result.draft.missingInformation ?? []);
      setFollowUps(result.draft.clarificationQuestions ?? []);
      setAiMessage("تم تجهيز المسودة. راجعها ثم اضغط «تطبيق الاقتراح» إن رغبت.");
      setSampleFilled(false);
    });
  }

  function applyAiSuggestion() {
    if (!aiDraft) return;

    const dirty = formHasUserEnteredData({
      title,
      notes,
      deliveryCity: cityChoice,
      deliveryDistrict,
      deliveryAddressText,
      items,
    });

    let overwrite = true;
    if (dirty) {
      const ok = window.confirm(
        "النموذج يحتوي على بيانات مدخلة. هل تريد استبدالها باقتراح المساعد؟",
      );
      if (!ok) return;
      overwrite = true;
    }

    const mapped = mapRequirementDraftToForm(aiDraft);
    const merged = mergeMappedDraft(
      { title, notes, cityChoice, otherCity, items },
      mapped,
      overwrite,
    );

    setTitle(merged.title);
    setNotes(merged.notes);
    setCityChoice(merged.cityChoice);
    setOtherCity(merged.otherCity);
    setItems(merged.items);
    setMissingInfo(merged.missingInformation);
    setFollowUps(merged.clarificationQuestions);
    setAiMessage("تم تطبيق الاقتراح. يمكنك تعديل أي حقل قبل المراجعة والنشر.");
    setSampleFilled(false);
  }

  function cleanedItems() {
    return items.map((item) => ({
      productName: item.productName.trim(),
      description: item.description.trim() || undefined,
      quantity: Number(item.quantity),
      unitLabel: item.unitLabel.trim(),
      specificationNotes: item.specificationNotes.trim() || undefined,
      acceptedAlternatives: item.acceptedAlternatives.trim() || undefined,
      brandPreference: item.brandPreference.trim() || undefined,
      minShelfLifeMonths: item.minShelfLifeMonths
        ? Number(item.minShelfLifeMonths)
        : null,
    }));
  }

  function validateClient() {
    const cleaned = cleanedItems().filter(
      (item) => item.productName.length > 0 || item.unitLabel.length > 0 || item.quantity > 0,
    );
    const validation = validatePublishRequest({
      title,
      deliveryCity,
      deliveryDistrict,
      deliveryAddressText,
      deliveryAddressId,
      neededByDate,
      submissionDeadline,
      items: cleaned.length ? cleaned : cleanedItems(),
    });
    if (!validation.ok) {
      setError(validation.message);
      setFieldErrors(validation.fieldErrors);
      setReviewOpen(false);
      return null;
    }
    setError(null);
    setFieldErrors({});
    return cleaned;
  }

  function openReview(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = validateClient();
    if (!cleaned) return;
    setReviewOpen(true);
  }

  function onPublish() {
    const cleaned = validateClient();
    if (!cleaned) return;

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("notes", notes.trim());
    fd.set("rawRequirementText", rawText.trim());
    fd.set("neededByDate", neededByDate);
    fd.set("submissionDeadline", submissionDeadline);
    fd.set("deliveryCity", deliveryCity);
    fd.set("deliveryDistrict", deliveryDistrict);
    fd.set("deliveryAddressText", deliveryAddressText);
    fd.set("categoryId", categoryId);
    if (isOtherCategory && categoryOtherText.trim()) {
      fd.set("categoryOtherText", categoryOtherText.trim());
    }
    if (branchId) fd.set("branchId", branchId);
    if (deliveryAddressId) fd.set("deliveryAddressId", deliveryAddressId);
    fd.set("itemsJson", JSON.stringify(cleaned));

    startTransition(async () => {
      try {
        await publishPurchaseRequest(fd);
      } catch (err) {
        const message = err instanceof Error ? err.message : "تعذر نشر الطلب";
        setError(arabicPublishError(message) === message ? message : arabicPublishError(message));
        setReviewOpen(false);
      }
    });
  }

  const fieldError = (key: string) =>
    fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null;

  return (
    <div className="request-composer">
      {error ? (
        <div className="error-summary" role="alert">
          <strong>تعذر المتابعة</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {sampleFilled ? (
        <div className="sample-banner" role="status">
          تم تعبئة نموذج تجريبي قابل للتعديل — راجع البيانات قبل النشر.
        </div>
      ) : null}

      <section className="panel composer-section">
        <div className="panel-title">
          <div>
            <h3>١. اكتب احتياجك</h3>
            <p>اختياري — استخدم المساعد أو النموذج التجريبي، ثم أكمل التفاصيل أدناه.</p>
          </div>
          <button type="button" className="btn outline" onClick={fillSample}>
            تعبئة نموذج تجريبي
          </button>
        </div>
        <p className="helper-text" style={{ marginTop: 0 }}>
          يملأ مثالًا يمكنك تعديله قبل النشر.
        </p>

        <div className="ai-assist-block">
          <label htmlFor="raw-requirement">مساعد صياغة الاحتياج</label>
          <p className="helper-text" style={{ marginTop: 0, marginBottom: 8 }}>
            اكتب احتياجك بطريقتك، وسنقترح لك مسودة مرتبة يمكنك مراجعتها قبل إضافتها.
          </p>
          <textarea
            id="raw-requirement"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="مثال: أبي 10 كراتين أكواب قهوة ورقية 8 أونص، لون أبيض، والتوصيل إلى حائل قبل الخميس."
            rows={3}
            disabled={aiPending}
          />
          <div className="textarea-foot">
            <span>اختياري — لا يُحفظ ولا يُنشر شيء تلقائيًا</span>
            <div className="ai-assist-actions">
              <button
                type="button"
                className="btn outline"
                onClick={runAi}
                disabled={aiPending}
              >
                {aiPending ? "جارٍ تحليل الاحتياج..." : "تحليل الاحتياج"}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={applyAiSuggestion}
                disabled={aiPending || !aiDraft}
              >
                تطبيق الاقتراح
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={clearAiSuggestion}
                disabled={aiPending || (!aiDraft && !aiMessage && !aiError)}
              >
                إلغاء
              </button>
            </div>
          </div>
          {aiError ? (
            <p className="helper-text ai-error-notice" role="alert">
              {aiError}
            </p>
          ) : null}
          {aiMessage ? <p className="helper-text soft-notice">{aiMessage}</p> : null}
          {aiDraft ? (
            <div className="ai-draft-preview" role="status">
              <strong>معاينة المسودة</strong>
              {aiEngine ? (
                <p className="helper-text" dir="ltr" style={{ marginTop: 2 }}>
                  Powered by {aiEngine}
                </p>
              ) : null}
              {aiDraft.requestTitle ? <p>العنوان: {aiDraft.requestTitle}</p> : null}
              {aiDraft.deliveryCity ? <p>مدينة التوصيل: {aiDraft.deliveryCity}</p> : null}
              {aiDraft.requestedDeliveryText ? (
                <p>موعد التوصيل المذكور: {aiDraft.requestedDeliveryText}</p>
              ) : null}
              {aiDraft.items.length > 0 ? (
                <ul>
                  {aiDraft.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      {item.name}
                      {item.quantity != null ? ` — ${item.quantity}` : ""}
                      {item.unit ? ` ${item.unit}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {missingInfo.length > 0 || followUps.length > 0 ? (
            <div className="ai-missing-banner" role="status">
              <strong>معلومات ناقصة، صفقة تسأل بدل ما تخمن</strong>
              <ul className="followup-list">
                {(followUps.length > 0 ? followUps : missingInfo).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <form className="panel composer-section" onSubmit={openReview} noValidate>
        <div className="panel-title">
          <div>
            <h3>٢. معلومات الطلب</h3>
            <p>بيانات التوصيل والمواعيد تظهر للمورد كما تدخلها هنا.</p>
          </div>
        </div>

        <div className="fields">
          <label style={{ gridColumn: "1 / -1" }}>
            عنوان الطلب
            <input
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSampleFilled(false);
              }}
              placeholder="مثال: توريد أكواب قهوة ورقية لفروع حائل"
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldError("title")}
          </label>

          <label>
            التصنيف التقريبي
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">غير محدد (اختياري)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="helper-text">
              يُستخدم فقط لمطابقة الموردين المناسبين، ولا يستبدل اسم المنتج.
            </span>
          </label>

          {isOtherCategory ? (
            <label>
              تصنيف مخصص
              <input
                value={categoryOtherText}
                onChange={(e) => setCategoryOtherText(e.target.value)}
                placeholder="اكتب التصنيف باختصار"
                maxLength={80}
              />
            </label>
          ) : (
            <div />
          )}

          <label>
            مدينة التوصيل
            <ThemeSelect
              required
              value={cityChoice}
              options={DELIVERY_CITY_OPTIONS}
              onChange={(next) => {
                setCityChoice(next);
                setSampleFilled(false);
                if (next !== OTHER_CITY) setOtherCity("");
              }}
              placeholder="اختر المدينة"
              aria-invalid={Boolean(fieldErrors.deliveryCity)}
              aria-label="مدينة التوصيل"
            />
            {fieldError("deliveryCity")}
          </label>

          {cityChoice === OTHER_CITY ? (
            <label>
              اسم المدينة
              <input
                required
                value={otherCity}
                onChange={(e) => setOtherCity(e.target.value)}
                placeholder="اكتب اسم المدينة"
              />
            </label>
          ) : (
            <label>
              الحي / المنطقة
              <input
                value={deliveryDistrict}
                onChange={(e) => setDeliveryDistrict(e.target.value)}
                placeholder={deliveryCity ? `حي في ${deliveryCity}` : "مثال: النقرة"}
              />
            </label>
          )}

          {cityChoice === OTHER_CITY ? (
            <label>
              الحي / المنطقة
              <input
                value={deliveryDistrict}
                onChange={(e) => setDeliveryDistrict(e.target.value)}
              />
            </label>
          ) : null}

          <label>
            الفرع
            <select
              value={branchId}
              onChange={(e) => {
                const nextId = e.target.value;
                setBranchId(nextId);
                const branch = branches.find((b) => b.id === nextId);
                if (branch) applyCityFromSource(branch.city, branch.district);
                const nextAddress = addresses.find((a) => a.branchId === nextId);
                setDeliveryAddressId(nextAddress?.id ?? "");
                if (nextAddress) {
                  applyCityFromSource(nextAddress.city, nextAddress.district);
                }
              }}
            >
              <option value="">بدون تحديد</option>
              {(filteredBranches.length ? filteredBranches : branches).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.city ? ` — ${b.city}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            عنوان محفوظ
            <select
              value={deliveryAddressId}
              onChange={(e) => {
                const nextId = e.target.value;
                setDeliveryAddressId(nextId);
                const address = addresses.find((a) => a.id === nextId);
                if (address) {
                  applyCityFromSource(address.city, address.district);
                  if (address.branchId) setBranchId(address.branchId);
                }
              }}
            >
              <option value="">بدون تحديد</option>
              {filteredAddresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.district}
                </option>
              ))}
            </select>
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            تفاصيل عنوان التوصيل
            <input
              value={deliveryAddressText}
              onChange={(e) => setDeliveryAddressText(e.target.value)}
              placeholder="شارع، رقم مبنى، ملاحظات وصول للمورد بعد الترسية"
              aria-invalid={Boolean(fieldErrors.deliveryAddressText)}
            />
            {fieldError("deliveryAddressText")}
          </label>

          <label>
            تاريخ التوصيل المطلوب
            <input
              type="date"
              required
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
              aria-invalid={Boolean(fieldErrors.neededByDate)}
            />
            {fieldError("neededByDate")}
          </label>

          <label>
            آخر موعد لتقديم العروض
            <input
              type="datetime-local"
              required
              value={submissionDeadline}
              onChange={(e) => setSubmissionDeadline(e.target.value)}
              aria-invalid={Boolean(fieldErrors.submissionDeadline)}
            />
            {fieldError("submissionDeadline")}
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            ملاحظات عامة
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="line-items-section">
          <div className="panel-title">
            <div>
              <h3>٣. بنود الطلب</h3>
              <p>يجب أن تكون جميع البنود قابلة للتنفيذ من مورد واحد.</p>
            </div>
            <button
              type="button"
              className="btn outline"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              إضافة بند
            </button>
          </div>
          {fieldError("items")}

          {items.map((item, index) => (
            <div key={index} className="line-item-card">
              <div className="line-item-card__head">
                <strong>البند {index + 1}</strong>
                {items.length > 1 ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  >
                    حذف البند
                  </button>
                ) : null}
              </div>
              <div className="fields">
                <label style={{ gridColumn: "1 / -1" }}>
                  اسم المنتج
                  <input
                    required
                    value={item.productName}
                    onChange={(e) => {
                      updateItem(index, { productName: e.target.value });
                      setSampleFilled(false);
                    }}
                    placeholder="مثال: أكواب قهوة ورقية مزدوجة الجدار"
                    aria-invalid={Boolean(fieldErrors[`items.${index}.productName`])}
                  />
                  {fieldError(`items.${index}.productName`)}
                </label>
                <label>
                  الكمية
                  <input
                    type="number"
                    min={1}
                    required
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, {
                        quantity: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    aria-invalid={Boolean(fieldErrors[`items.${index}.quantity`])}
                  />
                  {fieldError(`items.${index}.quantity`)}
                </label>
                <label>
                  الوحدة
                  <input
                    required
                    value={item.unitLabel}
                    onChange={(e) => updateItem(index, { unitLabel: e.target.value })}
                    placeholder="مثال: كرتون"
                    aria-invalid={Boolean(fieldErrors[`items.${index}.unitLabel`])}
                  />
                  {fieldError(`items.${index}.unitLabel`)}
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  المواصفات
                  <input
                    value={item.specificationNotes || item.description}
                    onChange={(e) =>
                      updateItem(index, {
                        specificationNotes: e.target.value,
                        description: e.target.value,
                      })
                    }
                    placeholder="الخامة، المقاس، اللون، أو أي تفاصيل مهمة"
                  />
                </label>
                <label>
                  تفضيل العلامة (اختياري)
                  <input
                    value={item.brandPreference}
                    onChange={(e) => updateItem(index, { brandPreference: e.target.value })}
                  />
                </label>
                <label>
                  بدائل مقبولة (اختياري)
                  <input
                    value={item.acceptedAlternatives}
                    onChange={(e) =>
                      updateItem(index, { acceptedAlternatives: e.target.value })
                    }
                  />
                </label>
                {(item.minShelfLifeMonths ||
                  item.productName.includes("زيت") ||
                  item.productName.includes("غذاء")) && (
                  <label>
                    حد أدنى للصلاحية بالأشهر (إن لزم)
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={item.minShelfLifeMonths}
                      onChange={(e) =>
                        updateItem(index, { minShelfLifeMonths: e.target.value })
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="composer-publish">
          <h3>٤. المراجعة والنشر</h3>
          <p className="helper-text">
            راجع ملخص الطلب ثم انشره لاستقبال عروض الموردين.
          </p>
          <div className="panel-actions">
            <button className="btn primary" type="submit" disabled={pending}>
              مراجعة قبل النشر
            </button>
          </div>
        </div>
      </form>

      {reviewOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="modal review-modal">
            <h3 id="review-title">ملخص طلب الشراء</h3>
            <dl className="review-summary">
              <div>
                <dt>العنوان</dt>
                <dd>{title}</dd>
              </div>
              <div>
                <dt>موقع التوصيل</dt>
                <dd>
                  {deliveryCity}
                  {deliveryDistrict ? ` — ${deliveryDistrict}` : ""}
                  {deliveryAddressText ? ` · ${deliveryAddressText}` : ""}
                </dd>
              </div>
              <div>
                <dt>تاريخ التوصيل المطلوب</dt>
                <dd>{formatDate(neededByDate)}</dd>
              </div>
              <div>
                <dt>آخر موعد للعروض</dt>
                <dd>{formatDateTime(submissionDeadline)}</dd>
              </div>
              <div>
                <dt>عدد البنود</dt>
                <dd>{items.filter((i) => i.productName.trim()).length}</dd>
              </div>
            </dl>
            <ul className="review-items">
              {items
                .filter((i) => i.productName.trim())
                .map((item, index) => (
                  <li key={index}>
                    {item.productName} — {item.quantity} {item.unitLabel}
                  </li>
                ))}
            </ul>
            <div className="panel-actions" style={{ justifyContent: "center" }}>
              <button type="button" className="btn ghost" onClick={() => setReviewOpen(false)}>
                تعديل
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={pending}
                onClick={onPublish}
              >
                {pending ? "جارٍ النشر..." : "نشر طلب الشراء"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
