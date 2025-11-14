package com.pawcare.dto;

import com.pawcare.entity.OperationLog;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class ReportSummary {
    public String period;
    public String from;
    public String to;
    public int appointmentsDone;
    public int prescriptionsDispensed;
    public int petsAdded;
    public BigDecimal totalRevenue = BigDecimal.ZERO;
    public List<OperationLog> events = new ArrayList<>();
    public List<NewPatient> newPatients = new ArrayList<>();
    public List<FinishedAppointment> finishedAppointments = new ArrayList<>();

    public static class NewPatient {
        public Long petId;
        public String petName;
        public String ownerName;
        public String addedAt;
    }

    public static class FinishedAppointment {
        public Long appointmentId;
        public String code;
        public String date;
        public String time;
        public String vet;
        public String vetUsername;
        public String petName;
        public String ownerName;
        public List<String> procedures = new ArrayList<>();
        public BigDecimal totalCost = BigDecimal.ZERO;
    }
}


