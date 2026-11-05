"use client";

import { useMemo, useState, useTransition } from "react";
import { updateSupplierProfile } from "@/app/actions/mutations";
import { ThemeSelect } from "@/components/theme-select";
import { OTHER_CITY, SAUDI_CITIES } from "@/lib/saudi-cities";

const MAIN_CITY_OPTIONS = [
  ...SAUDI_CITIES.map((c) => ({ value: c, label: c })),
  { value: OTHER_CITY, label: OTHER_CITY },
];

function parseCities(value: string | null | undefined) {
  return (value ?? "")
    .split(/[،,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function SupplierProfileForm({
  city,
  serviceCities,
  about,
  saved,
}: {
  city: string;
  serviceCities: string;
  about: string;
  saved?: boolean;
}) {
  const initialService = useMemo(() => parseCities(serviceCities), [serviceCities]);
  const [mainCity, setMainCity] = useState(
    (SAUDI_CITIES as readonly string[]).includes(city) ? city : OTHER_CITY,
  );
  const [otherMainCity, setOtherMainCity] = useState(
    (SAUDI_CITIES as readonly string[]).includes(city) ? "" : city,
  );
  const [selected, setSelected] = useState<string[]>(
    initialService.length ? initialService : [city || "الرياض"],
  );
  const [customCity, setCustomCity] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleCity(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );
  }

  function addCustomCity() {
    const value = customCity.trim();
    if (!value) return;
    setSelected((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCustomCity("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const resolvedCity = mainCity === OTHER_CITY ? otherMainCity.trim() : mainCity;
    if (!resolvedCity) {
      setError("حدد المدينة الرئيسية.");
      return;
    }
    if (selected.length === 0) {
      setError("اختر مدينة خدمة واحدة على الأقل.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("city", resolvedCity);
    fd.set("serviceCities", selected.join("، "));
    startTransition(async () => {
      try {
        await updateSupplierProfile(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر حفظ الملف");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="panel">
      <h3 style={{ marginTop: 0 }}>تعديل الملف</h3>
      {saved ? (
        <div className="sample-banner" role="status">
          تم حفظ التعديلات بنجاح.
        </div>
      ) : null}
      {error ? (
        <div className="error-summary" role="alert">
          {error}
        </div>
      ) : null}

      <div className="fields">
        <label>
          المدينة الرئيسية
          <ThemeSelect
            value={mainCity}
            options={MAIN_CITY_OPTIONS}
            onChange={setMainCity}
            required
            aria-label="المدينة الرئيسية"
          />
        </label>
        {mainCity === OTHER_CITY ? (
          <label>
            اسم المدينة
            <input
              value={otherMainCity}
              onChange={(e) => setOtherMainCity(e.target.value)}
              required
            />
          </label>
        ) : (
          <div />
        )}

        <div style={{ gridColumn: "1 / -1" }}>
          <strong style={{ fontSize: 13.5 }}>مدن ومناطق الخدمة</strong>
          <p className="helper-text">
            تُستخدم هذه المدن لمطابقة فرص التوريد. اختر المدن التي تستطيع التوريد إليها.
          </p>
          <div className="city-chips" role="group" aria-label="مدن الخدمة">
            {SAUDI_CITIES.map((c) => {
              const on = selected.includes(c);
              return (
                <label key={c} className={on ? "city-chip is-on" : "city-chip"}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleCity(c)}
                  />
                  {c}
                </label>
              );
            })}
            {selected
              .filter((c) => !(SAUDI_CITIES as readonly string[]).includes(c))
              .map((c) => (
                <label key={c} className="city-chip is-on">
                  <input type="checkbox" checked onChange={() => toggleCity(c)} />
                  {c}
                </label>
              ))}
          </div>
          <div className="fields" style={{ marginTop: 10 }}>
            <label>
              إضافة مدينة أخرى
              <input
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="مثال: الخرج"
              />
            </label>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="button" className="btn outline" onClick={addCustomCity}>
                إضافة
              </button>
            </div>
          </div>
        </div>

        <label style={{ gridColumn: "1 / -1" }}>
          نبذة عن المنشأة
          <textarea
            name="about"
            rows={4}
            defaultValue={about}
            placeholder="نبذة مختصرة عن نشاطكم ومجالات التوريد التي تخدمونها"
          />
        </label>
      </div>

      <div className="panel-actions" style={{ marginTop: 16 }}>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
        </button>
      </div>
    </form>
  );
}
