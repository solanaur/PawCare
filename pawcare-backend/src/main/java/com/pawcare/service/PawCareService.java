package com.pawcare.service;

import com.pawcare.entity.*;
import com.pawcare.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.pawcare.dto.ReportSummary;
import com.pawcare.dto.ReportSummary.FinishedAppointment;
import com.pawcare.dto.ReportSummary.NewPatient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class PawCareService {

    @Autowired
    private PetRepository petRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OperationLogRepository operationLogRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ProcedureCatalogService procedureCatalogService;
    // Pet operations
    public List<Pet> getAllPets() {
        return petRepository.findAll();
    }

    public Optional<Pet> getPetById(Long id) {
        return petRepository.findById(id);
    }

    public Pet savePet(Pet pet) {
        Pet savedPet = petRepository.save(pet);
        logOperation("PET_CREATED", "Added pet " + savedPet.getName(), savedPet.getId());
        return savedPet;
    }

    public Pet updatePet(Long id, Pet pet) {
        pet.setId(id);
        Pet updatedPet = petRepository.save(pet);
        logOperation("PET_UPDATED", "Updated pet " + updatedPet.getName(), updatedPet.getId());
        return updatedPet;
    }

    public void deletePet(Long id) {
        Optional<Pet> pet = petRepository.findById(id);
        if (pet.isPresent()) {
            logOperation("PET_DELETED", "Deleted pet " + pet.get().getName(), id);
            petRepository.deleteById(id);
        }
    }

    public Pet addProcedureToPet(Long petId, Procedure procedure) {
        Optional<Pet> petOpt = petRepository.findById(petId);
        if (petOpt.isPresent()) {
            Pet pet = petOpt.get();
            enrichProcedureFromCatalog(procedure);
            procedure.setPet(pet);
            pet.getProcedures().add(procedure);
            return petRepository.save(pet);
        }
        throw new RuntimeException("Pet not found with id: " + petId);
    }

    // Appointment operations
    public List<Appointment> getAllAppointments() {
        return appointmentRepository.findAll();
    }

    public Optional<Appointment> getAppointmentById(Long id) {
        return appointmentRepository.findById(id);
    }

    public Appointment saveAppointment(Appointment appointment, User actor) {
        normalizeAppointment(appointment);
        ensureAppointmentPermissions(appointment, actor, true);
        appointment.setStatus("Pending");
        if (!StringUtils.hasText(appointment.getCode())) {
            appointment.setCode(generateAppointmentCode());
        }
        ensureSlotAvailable(appointment, null);
        Appointment savedAppointment = appointmentRepository.save(appointment);
        logOperation("APPT_CREATED", "Appointment created for " + savedAppointment.getOwner(), savedAppointment.getPetId());
        return savedAppointment;
    }

    public Appointment updateAppointment(Long id, Appointment appointment, User actor) {
        Appointment existing = appointmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        appointment.setId(id);
        if (!StringUtils.hasText(appointment.getCode())) {
            appointment.setCode(existing.getCode());
        }
        normalizeAppointment(appointment);
        
        // Filter by role instead of throwing errors
        String role = actor.getRole().toLowerCase();
        if ("vet".equals(role)) {
            // Vets can only update their own appointments
            if (existing.getAssignedVetId() != null && !actor.getId().equals(existing.getAssignedVetId())) {
                throw new IllegalArgumentException("You can only update your own appointments");
            }
            // Ensure vet is assigned to themselves
            appointment.setAssignedVetId(actor.getId());
            appointment.setVetUsername(actor.getUsername());
            appointment.setVet(actor.getName());
        } else if ("receptionist".equals(role) || "admin".equals(role)) {
            // Admin and Receptionist can assign to any vet
            if (appointment.getAssignedVetId() != null) {
                User vetUser = userRepository.findById(appointment.getAssignedVetId())
                        .filter(u -> u.getRole().equalsIgnoreCase("vet"))
                        .orElseThrow(() -> new IllegalArgumentException("Assigned vet not found"));
                appointment.setVetUsername(vetUser.getUsername());
                appointment.setVet(vetUser.getName());
            } else if (StringUtils.hasText(appointment.getVetUsername())) {
                User vetUser = userRepository.findByUsernameIgnoreCase(appointment.getVetUsername())
                        .filter(u -> u.getRole().equalsIgnoreCase("vet"))
                        .orElseThrow(() -> new IllegalArgumentException("Assigned vet not found"));
                appointment.setVetUsername(vetUser.getUsername());
                appointment.setVet(vetUser.getName());
                appointment.setAssignedVetId(vetUser.getId());
            } else {
                throw new IllegalArgumentException("An active vet must be assigned to the appointment");
            }
        } else {
            throw new IllegalArgumentException("Your role does not permit managing appointments");
        }
        
        ensureSlotAvailable(appointment, existing);
        return appointmentRepository.save(appointment);
    }

    public void deleteAppointment(Long id, User actor) {
        Appointment existing = appointmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        // Filter by role instead of throwing errors
        String role = actor.getRole().toLowerCase();
        if ("vet".equals(role)) {
            // Vets can only delete their own appointments
            if (existing.getAssignedVetId() != null && !actor.getId().equals(existing.getAssignedVetId())) {
                throw new IllegalArgumentException("You can only delete your own appointments");
            }
        } else if (!List.of("admin", "receptionist").contains(role)) {
            throw new IllegalArgumentException("You do not have permission to delete appointments");
        }
        logOperation("APPT_DELETED", "Removed appointment #" + id, existing.getPetId());
        appointmentRepository.deleteById(id);
    }

    public Appointment approveAppointment(Long id, User actor) {
        Optional<Appointment> appointmentOpt = appointmentRepository.findById(id);
        if (appointmentOpt.isPresent()) {
            Appointment appointment = appointmentOpt.get();
            // Filter by role instead of throwing errors
            String role = actor.getRole().toLowerCase();
            if ("vet".equals(role)) {
                // Vets can only approve their own appointments
                if (appointment.getAssignedVetId() != null && !actor.getId().equals(appointment.getAssignedVetId())) {
                    throw new IllegalArgumentException("You can only approve your own appointments");
                }
            } else if (!"admin".equals(role)) {
                throw new IllegalArgumentException("Only vets and admins can approve appointments");
            }
            appointment.setStatus("Approved by Vet");
            logOperation("APPT_APPROVED", "Appointment approved for " + appointment.getOwner(), appointment.getPetId());
            return appointmentRepository.save(appointment);
        }
        throw new RuntimeException("Appointment not found with id: " + id);
    }

    public Appointment markAppointmentDone(Long id, User actor) {
        Optional<Appointment> appointmentOpt = appointmentRepository.findById(id);
        if (appointmentOpt.isPresent()) {
            Appointment appointment = appointmentOpt.get();
            // Filter by role instead of throwing errors
            String role = actor.getRole().toLowerCase();
            if ("vet".equals(role)) {
                // Vets can only mark their own appointments as done
                if (appointment.getAssignedVetId() != null && !actor.getId().equals(appointment.getAssignedVetId())) {
                    throw new IllegalArgumentException("You can only mark your own appointments as done");
                }
            } else if (!"admin".equals(role)) {
                throw new IllegalArgumentException("Only vets and admins can mark appointments as done");
            }
            appointment.setStatus("Done");
            appointment.setCompletedAt(LocalDate.now());
            logOperation("APPT_DONE", "Appointment done for " + appointment.getOwner(), appointment.getPetId());
            return appointmentRepository.save(appointment);
        }
        throw new RuntimeException("Appointment not found with id: " + id);
    }

    // Prescription operations
    public List<Prescription> getAllPrescriptions() {
        return prescriptionRepository.findAll();
    }

    public Optional<Prescription> getPrescriptionById(Long id) {
        return prescriptionRepository.findById(id);
    }

    public Prescription savePrescription(Prescription prescription) {
        Prescription savedPrescription = prescriptionRepository.save(prescription);
        logOperation("RX_CREATED", "Rx issued for " + savedPrescription.getPet() + " (" + savedPrescription.getDrug() + ")", savedPrescription.getPetId());
        return savedPrescription;
    }

    public Prescription updatePrescription(Long id, Prescription prescription) {
        prescription.setId(id);
        return prescriptionRepository.save(prescription);
    }

    public void deletePrescription(Long id) {
        prescriptionRepository.deleteById(id);
    }

    public Prescription dispensePrescription(Long id) {
        Optional<Prescription> prescriptionOpt = prescriptionRepository.findById(id);
        if (prescriptionOpt.isPresent()) {
            Prescription prescription = prescriptionOpt.get();
            prescription.setDispensed(true);
            prescription.setDispensedAt(LocalDate.now());
            logOperation("RX_DISPENSED", "Rx dispensed for " + prescription.getPet(), prescription.getPetId());
            return prescriptionRepository.save(prescription);
        }
        throw new RuntimeException("Prescription not found with id: " + id);
    }

    // User operations
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public List<User> getActiveVets() {
        return userRepository.findAll().stream()
                .filter(u -> u.getRole().equalsIgnoreCase("vet"))
                .filter(User::isActive)
                .toList();
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public User saveUser(User user) {
        if (user.getUsername() == null || user.getUsername().isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        // Check if username exists (for new users only)
        if (user.getId() == null && userRepository.existsByUsernameIgnoreCase(user.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        // Password is required for new users
        if (user.getId() == null && (user.getPassword() == null || user.getPassword().isBlank())) {
            throw new IllegalArgumentException("Password is required for new users");
        }
        // Encode password if provided
        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(user.getPassword()));
        }
        // Set default active status if not set
        if (user.getId() == null) {
            user.setActive(true);
        }
        return userRepository.save(user);
    }

    public User updateUser(Long id, User user) {
        user.setId(id);
        if (userRepository.findByUsernameIgnoreCase(user.getUsername())
                .filter(existing -> !existing.getId().equals(id))
                .isPresent()) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(user.getPassword()));
        } else {
            userRepository.findById(id).ifPresent(existing -> user.setPasswordHash(existing.getPasswordHash()));
        }
        if (user.getUsername() == null || user.getUsername().isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        return userRepository.save(user);
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    // Operation log operations
    public List<OperationLog> getOperationLogsBetween(LocalDate from, LocalDate to) {
        return operationLogRepository.findByDateRange(from, to);
    }

    public ReportSummary generateReportSummary(String period, LocalDate start, LocalDate end) {
        ReportSummary summary = new ReportSummary();
        summary.period = period;
        summary.from = start.toString();
        summary.to = end.toString();

        List<OperationLog> logs = getOperationLogsBetween(start, end);
        summary.events = logs;

        // New patients based on PET_CREATED logs in the window
        logs.stream()
                .filter(log -> "PET_CREATED".equalsIgnoreCase(log.getType()))
                .forEach(log -> petRepository.findById(log.getPetId()).ifPresent(pet -> {
                    NewPatient patient = new NewPatient();
                    patient.petId = pet.getId();
                    patient.petName = pet.getName();
                    patient.ownerName = pet.getOwner();
                    patient.addedAt = log.getTs() != null ? log.getTs().toString() : summary.from;
                    summary.newPatients.add(patient);
                }));
        summary.petsAdded = summary.newPatients.size();

        // Finished appointments (Done status with completedAt inside window)
        List<Appointment> appointments = appointmentRepository.findAll().stream()
                .filter(appt -> "Done".equalsIgnoreCase(appt.getStatus()))
                .filter(appt -> appt.getCompletedAt() != null)
                .filter(appt -> !appt.getCompletedAt().isBefore(start) && !appt.getCompletedAt().isAfter(end))
                .toList();

        appointments.forEach(appt -> {
            FinishedAppointment item = new FinishedAppointment();
            item.appointmentId = appt.getId();
            item.code = appt.getCode();
            item.date = appt.getCompletedAt().toString();
            item.time = appt.getTime();
            item.vet = appt.getVet();
            item.vetUsername = appt.getVetUsername();
            item.ownerName = appt.getOwner();

            Pet pet = appt.getPet();
            if (pet == null && appt.getPetId() != null) {
                pet = petRepository.findById(appt.getPetId()).orElse(null);
            }
            if (pet != null) {
                item.petName = pet.getName();
                List<com.pawcare.entity.Procedure> todaysProcedures = pet.getProcedures().stream()
                        .filter(proc -> proc.getDate() != null && proc.getDate().equals(appt.getCompletedAt()))
                        .collect(Collectors.toList());
                item.procedures = todaysProcedures.stream()
                        .map(proc -> StringUtils.hasText(proc.getProcedure()) ? proc.getProcedure() : proc.getCategory())
                        .collect(Collectors.toList());
                item.totalCost = todaysProcedures.stream()
                        .map(proc -> proc.getCost() != null ? proc.getCost() : java.math.BigDecimal.ZERO)
                        .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            } else {
                item.petName = "";
            }

            summary.finishedAppointments.add(item);
        });

        summary.appointmentsDone = summary.finishedAppointments.size();
        summary.totalRevenue = summary.finishedAppointments.stream()
                .map(item -> item.totalCost)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        summary.prescriptionsDispensed = (int) prescriptionRepository.findAll().stream()
                .filter(r -> r.isDispensed() && r.getDispensedAt() != null)
                .filter(r -> !r.getDispensedAt().isBefore(start) && !r.getDispensedAt().isAfter(end))
                .count();

        return summary;
    }

    private void logOperation(String type, String message, Long petId) {
        OperationLog log = new OperationLog();
        log.setTs(LocalDateTime.now());
        log.setType(type);
        log.setMessage(message);
        log.setPetId(petId);
        operationLogRepository.save(log);
    }

    private void normalizeAppointment(Appointment appointment) {
        if (appointment.getTime() == null) {
            throw new IllegalArgumentException("Time is required");
        }
        LocalTime time = parseAndValidateTime(appointment.getTime());
        appointment.setTime(time.toString());
        if (appointment.getDate() == null) {
            throw new IllegalArgumentException("Date is required");
        }
        if (appointment.getPetId() == null) {
            throw new IllegalArgumentException("Pet is required");
        }
        if (!StringUtils.hasText(appointment.getOwner())) {
            throw new IllegalArgumentException("Owner name is required");
        }
    }

    private LocalTime parseAndValidateTime(String timeText) {
        try {
            LocalTime time = LocalTime.parse(timeText.length() == 5 ? timeText : timeText.substring(0,5));
            if (time.getMinute() % 30 != 0 || time.getSecond() != 0) {
                throw new IllegalArgumentException("Appointments must start on 30-minute intervals");
            }
            LocalTime opening = LocalTime.of(8, 0);
            LocalTime closing = LocalTime.of(22, 0);
            if (time.isBefore(opening) || time.isAfter(closing)) {
                throw new IllegalArgumentException("Appointments must be between 08:00 and 22:00");
            }
            return time.withSecond(0).withNano(0);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid appointment time format. Use HH:mm.");
        }
    }

    private void ensureAppointmentPermissions(Appointment appointment, User actor, boolean creating) {
        String role = actor.getRole().toLowerCase();
        if ("vet".equals(role)) {
            appointment.setVetUsername(actor.getUsername());
            appointment.setVet(actor.getName());
            appointment.setAssignedVetId(actor.getId());  // Set assigned vet ID
        } else if ("receptionist".equals(role) || "admin".equals(role)) {
            // If assignedVetId is provided, use it
            if (appointment.getAssignedVetId() != null) {
                User vetUser = userRepository.findById(appointment.getAssignedVetId())
                        .filter(u -> u.getRole().equalsIgnoreCase("vet"))
                        .orElseThrow(() -> new IllegalArgumentException("Assigned vet not found"));
                appointment.setVetUsername(vetUser.getUsername());
                appointment.setVet(vetUser.getName());
            } else if (StringUtils.hasText(appointment.getVetUsername())) {
                // Fallback to vetUsername if assignedVetId not provided
                User vetUser = userRepository.findByUsernameIgnoreCase(appointment.getVetUsername())
                        .filter(u -> u.getRole().equalsIgnoreCase("vet"))
                        .orElseThrow(() -> new IllegalArgumentException("Assigned vet not found"));
                appointment.setVetUsername(vetUser.getUsername());
                appointment.setVet(vetUser.getName());
                appointment.setAssignedVetId(vetUser.getId());  // Set assigned vet ID
            } else {
                throw new IllegalArgumentException("An active vet must be assigned to the appointment");
            }
        } else {
            throw new IllegalArgumentException("Your role does not permit managing appointments");
        }
    }

    private void ensureSlotAvailable(Appointment appointment, Appointment existing) {
        if (!StringUtils.hasText(appointment.getVetUsername())) {
            return;
        }
        appointmentRepository.findAll().stream()
                .filter(a -> appointment.getDate().equals(a.getDate()))
                .filter(a -> appointment.getTime().equals(a.getTime()))
                .filter(a -> appointment.getVetUsername() != null && appointment.getVetUsername().equalsIgnoreCase(Objects.toString(a.getVetUsername(), "")))
                .filter(a -> existing == null || !a.getId().equals(existing.getId()))
                .findAny()
                .ifPresent(a -> {
                    throw new IllegalArgumentException("Selected vet already has an appointment for this slot");
                });
    }

    private String generateAppointmentCode() {
        LocalDate today = LocalDate.now();
        String datePart = today.format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String randomPart = UUID.randomUUID().toString().replaceAll("-", "").substring(0, 6).toUpperCase();
        return "APPT-" + datePart + "-" + randomPart;
    }

    private void enrichProcedureFromCatalog(Procedure procedure) {
        procedureCatalogService.findByCode(procedure.getProcedureCode())
                .or(() -> procedureCatalogService.findByCategoryAndName(procedure.getCategory(), procedure.getProcedure()))
                .ifPresent(template -> {
                    procedure.setProcedureCode(template.code());
                    procedure.setProcedure(template.name());
                    if (procedure.getCost() == null || procedure.getCost().compareTo(BigDecimal.ZERO) <= 0) {
                        procedure.setCost(template.cost());
                    }
                    if (!StringUtils.hasText(procedure.getMedications())) {
                        procedure.setMedications(template.medications());
                    }
                    if (!StringUtils.hasText(procedure.getDosage())) {
                        procedure.setDosage(template.dosage());
                    }
                    if (!StringUtils.hasText(procedure.getDirections())) {
                        procedure.setDirections(template.directions());
                    }
                    if (!StringUtils.hasText(procedure.getNotes()) && StringUtils.hasText(template.directions())) {
                        procedure.setNotes(template.directions());
                    }
                });
    }
}

