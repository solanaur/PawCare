package com.pawcare.service;

import com.pawcare.dto.ProcedureTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ProcedureCatalogService {

    private final List<ProcedureTemplate> templates;
    private final Map<String, ProcedureTemplate> byCode;
    private final Map<String, List<ProcedureTemplate>> byCategory;

    public ProcedureCatalogService() {
        templates = List.of(
                // Consultation & Check-up
                template("CONSULT_STANDARD", "Consultation & Check-up", "Consultation Fee", 350, "", "", "General wellness consultation."),
                template("CONSULT_FOLLOWUP", "Consultation & Check-up", "Follow-Up Consultation", 250, "", "", "Short follow-up visit."),
                template("CONSULT_EMERGENCY", "Consultation & Check-up", "Emergency Fee", 800, "", "", "Emergency case consultation surcharge."),
                template("CONSULT_AFTERHOURS", "Consultation & Check-up", "After 9:00 PM Consultation", 500, "", "", "Applies to late night consults."),

                // Vaccination & Deworming
                template("VAC_FELINE_4IN1", "Vaccine & Deworming", "Feline 4-in-1 Vaccine", 1000, "Feline 4-in-1 Vaccine", "As directed", "Administer subcutaneously; observe for adverse reactions."),
                template("VAC_CANINE_5IN1", "Vaccine & Deworming", "Canine 5-in-1 Vaccine", 1000, "Canine 5-in-1 Vaccine", "As directed", "Follow core vaccine schedule."),
                template("VAC_CANINE_6IN1", "Vaccine & Deworming", "Canine 6-in-1 Vaccine", 1000, "Canine 6-in-1 Vaccine", "As directed", "Repeat per vaccination chart."),
                template("VAC_CANINE_8IN1", "Vaccine & Deworming", "Canine 8-in-1 Vaccine", 1200, "Canine 8-in-1 Vaccine", "As directed", "Annual booster recommended."),
                template("VAC_ANTIRABIES", "Vaccine & Deworming", "Anti-Rabies Vaccine", 350, "Anti-Rabies Vaccine", "1 ml", "Administer once yearly."),
                template("DEWORM_CANINE", "Vaccine & Deworming", "Canine Deworming", 250, "Anthelmintic", "5 mg/kg", "Repeat every 3 months."),
                template("DEWORM_FELINE", "Vaccine & Deworming", "Feline Deworming", 200, "Anthelmintic", "5 mg/kg", "Repeat every 3 months."),

                // Laboratory Tests
                template("LAB_CBC", "Laboratory Tests", "Complete Blood Count (CBC)", 550, "", "", "Collect EDTA sample; process same day."),
                template("LAB_BCHEM", "Laboratory Tests", "Comprehensive Blood Chemistry", 3550, "", "", "Fast patient 8h prior."),
                template("LAB_CHEM10", "Laboratory Tests", "Chemistry 10 Panel", 2250, "", "", "Fast patient 8h prior."),
                template("LAB_XRAY", "Laboratory Tests", "X-ray", 700, "", "", "Sedation as needed, provide positioning."),
                template("LAB_ULTRASOUND", "Laboratory Tests", "Ultrasound", 800, "", "", "Shave area; fasting advised."),
                template("LAB_ULTRASOUND_OB", "Laboratory Tests", "Ultrasound OB", 800, "", "", "Pregnancy monitoring."),
                template("LAB_URINALYSIS", "Laboratory Tests", "Urinalysis", 400, "", "", "Collect mid-stream sample."),
                template("LAB_FECALYSIS", "Laboratory Tests", "Fecalysis", 350, "", "", "Fresh stool sample."),

                // Rapid Tests
                template("RAPID_PARVO", "Rapid Tests", "Canine Parvo/Corona Rapid Test", 800, "", "", "Use stool sample; 10 minute read."),
                template("RAPID_GIARDIA", "Rapid Tests", "Giardia Drop Test", 800, "", "", "Fresh stool sample."),
                template("RAPID_FIVFELV", "Rapid Tests", "FIV/FeLV Test", 1100, "", "", "Whole blood sample."),

                // Surgical Service
                template("SURG_GENERAL", "Surgical Service", "General Surgery", 5000, "Ceftriaxone, Meloxicam", "Per protocol", "Administer pre-op antibiotics and analgesics."),
                template("SURG_DENTAL", "Surgical Service", "Dental Prophylaxis", 3500, "Clindamycin, Chlorhexidine Rinse", "Per protocol", "Post-op pain management for 3 days."),

                // Spaying & Castration
                template("SPAY_FELINE", "Spaying & Castration", "Feline Spaying", 8000, "Amoxicillin-Clavulanate, Carprofen", "Amoxiclav 12.5 mg/kg BID 7d; Carprofen 2 mg/kg SID 3d", "Keep incision dry; monitor for swelling."),
                template("NEUTER_FELINE", "Spaying & Castration", "Feline Castration", 6000, "Amoxicillin-Clavulanate, Tramadol", "Amoxiclav 12.5 mg/kg BID 5d; Tramadol 3 mg/kg q8h 3d", "Restrict activity 5 days."),
                template("SPAY_CANINE", "Spaying & Castration", "Canine Spaying", 14000, "Cephalexin, Carprofen", "Cephalexin 20 mg/kg BID 7d; Carprofen 4 mg/kg SID 5d", "Use Elizabethan collar until suture removal."),
                template("NEUTER_CANINE", "Spaying & Castration", "Canine Castration", 12000, "Cephalexin, Tramadol", "Cephalexin 20 mg/kg BID 5d; Tramadol 4 mg/kg q8h 3d", "Limit exercise for 7 days.")
        );

        byCode = templates.stream().collect(Collectors.toMap(ProcedureTemplate::code, Function.identity()));
        byCategory = templates.stream().collect(Collectors.groupingBy(
                ProcedureTemplate::category,
                LinkedHashMap::new,
                Collectors.toList()
        ));
    }

    private ProcedureTemplate template(String code, String category, String name, double cost,
                                       String medications, String dosage, String directions) {
        return new ProcedureTemplate(code, category, name, BigDecimal.valueOf(cost), medications, dosage, directions);
    }

    public List<ProcedureTemplate> all() {
        return templates;
    }

    public List<ProcedureTemplate> byCategory(String category) {
        return byCategory.getOrDefault(category, List.of());
    }

    public Optional<ProcedureTemplate> findByCode(String code) {
        if (!StringUtils.hasText(code)) return Optional.empty();
        return Optional.ofNullable(byCode.get(code));
    }

    public Optional<ProcedureTemplate> findByCategoryAndName(String category, String name) {
        if (!StringUtils.hasText(category) || !StringUtils.hasText(name)) return Optional.empty();
        return byCategory(category).stream()
                .filter(t -> name.equalsIgnoreCase(t.name()))
                .findFirst();
    }
}


