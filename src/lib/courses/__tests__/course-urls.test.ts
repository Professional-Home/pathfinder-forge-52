import { describe, it, expect } from "vitest";
import {
  BIOPLASTIC_APPLY_URL,
  DRUG_DISCOVERY_APPLY_URL,
  BIOINFORMATICS_APPLY_URL,
  COMMON_COURSE_APPLY_URL,
  COURSE_APPLY_URLS,
  getCourseApplyUrl,
} from "../data";

describe("Course Application URL Resolution", () => {
  describe("Authoritative URL Constants", () => {
    it("has the updated BioPlastic Innovation Google Form URL", () => {
      expect(BIOPLASTIC_APPLY_URL).toBe("https://forms.gle/8GiUvQuT6wU8iZbU6");
    });

    it("has the updated AI in Drug Discovery Google Form URL", () => {
      expect(DRUG_DISCOVERY_APPLY_URL).toBe("https://forms.gle/KZHJbuiKSpDsBqzp7");
    });

    it("has the updated AI Integrated Bioinformatics Google Form URL", () => {
      expect(BIOINFORMATICS_APPLY_URL).toBe("https://forms.gle/ZN1HcXnv5g2Z9YXd9");
    });

    it("maintains COMMON_COURSE_APPLY_URL identical to BIOINFORMATICS_APPLY_URL", () => {
      expect(COMMON_COURSE_APPLY_URL).toBe(BIOINFORMATICS_APPLY_URL);
      expect(COMMON_COURSE_APPLY_URL).toBe("https://forms.gle/ZN1HcXnv5g2Z9YXd9");
    });

    it("maps all slugs correctly in COURSE_APPLY_URLS dictionary", () => {
      expect(COURSE_APPLY_URLS["bioplastic-innovation"]).toBe("https://forms.gle/8GiUvQuT6wU8iZbU6");
      expect(COURSE_APPLY_URLS["ai-in-drug-discovery"]).toBe("https://forms.gle/KZHJbuiKSpDsBqzp7");
      expect(COURSE_APPLY_URLS["bioinformatics"]).toBe("https://forms.gle/ZN1HcXnv5g2Z9YXd9");
    });
  });

  describe("getCourseApplyUrl Resolution by Slug", () => {
    it("resolves bioplastic-innovation slug to BioPlastic URL", () => {
      expect(getCourseApplyUrl({ slug: "bioplastic-innovation" })).toBe(
        "https://forms.gle/8GiUvQuT6wU8iZbU6"
      );
    });

    it("resolves ai-in-drug-discovery slug to Drug Discovery URL", () => {
      expect(getCourseApplyUrl({ slug: "ai-in-drug-discovery" })).toBe(
        "https://forms.gle/KZHJbuiKSpDsBqzp7"
      );
    });

    it("resolves bioinformatics slug to Bioinformatics URL", () => {
      expect(getCourseApplyUrl({ slug: "bioinformatics" })).toBe(
        "https://forms.gle/ZN1HcXnv5g2Z9YXd9"
      );
    });
  });

  describe("getCourseApplyUrl Resolution by Name / Title", () => {
    it("resolves BioPlastic Innovation display name", () => {
      expect(getCourseApplyUrl({ name: "BioPlastic Innovation" })).toBe(
        "https://forms.gle/8GiUvQuT6wU8iZbU6"
      );
    });

    it("resolves AI in Drug Discovery title", () => {
      expect(getCourseApplyUrl({ title: "AI in Drug Discovery" })).toBe(
        "https://forms.gle/KZHJbuiKSpDsBqzp7"
      );
    });

    it("resolves AI Integrated Bioinformatics title", () => {
      expect(getCourseApplyUrl({ title: "AI Integrated Bioinformatics" })).toBe(
        "https://forms.gle/ZN1HcXnv5g2Z9YXd9"
      );
    });
  });

  describe("Unrelated Courses and Fallback Behavior", () => {
    it("preserves explicit apply_url when course identifier does not match target keywords", () => {
      const customUrl = "https://forms.gle/custom-genomics-fellowship";
      expect(
        getCourseApplyUrl({
          slug: "advanced-crispr-engineering",
          apply_url: customUrl,
        })
      ).toBe(customUrl);
    });

    it("preserves explicit applyUrl (camelCase) when course identifier does not match target keywords", () => {
      const customUrl = "https://company.org/apply-molecular-pathology";
      expect(
        getCourseApplyUrl({
          name: "Molecular Pathology Fellowship",
          applyUrl: customUrl,
        })
      ).toBe(customUrl);
    });

    it("falls back to BIOINFORMATICS_APPLY_URL when course has no match and no explicit URL", () => {
      expect(getCourseApplyUrl({})).toBe(BIOINFORMATICS_APPLY_URL);
      expect(getCourseApplyUrl(undefined)).toBe(BIOINFORMATICS_APPLY_URL);
    });
  });
});
