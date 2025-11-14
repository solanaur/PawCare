package com.pawcare.dto;

import java.math.BigDecimal;

public record ProcedureTemplate(
        String code,
        String category,
        String name,
        BigDecimal cost,
        String medications,
        String dosage,
        String directions
) {}


