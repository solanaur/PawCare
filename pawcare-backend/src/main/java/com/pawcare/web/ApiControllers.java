package com.pawcare.web;

import com.pawcare.entity.*;
import com.pawcare.service.PawCareService;
import com.pawcare.security.PawCareUserDetails;
import com.pawcare.service.ProcedureCatalogService;
import com.pawcare.dto.ProcedureTemplate;
import com.pawcare.dto.ReportSummary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ApiControllers {

    private final PawCareService pawCareService;
    private final String uploadDir;
    private final ProcedureCatalogService procedureCatalogService;

    public ApiControllers(
            PawCareService pawCareService,
            ProcedureCatalogService procedureCatalogService,
            @Value("${pawcare.upload-dir:uploads}") String uploadDir
    ) {
        this.pawCareService = pawCareService;
        this.procedureCatalogService = procedureCatalogService;
        this.uploadDir = (uploadDir == null || uploadDir.isBlank()) ? "uploads" : uploadDir;
        new File(this.uploadDir).mkdirs();
    }

    /* --------- Pets --------- */
    @GetMapping("/pets")
    @PreAuthorize("hasAnyRole('ADMIN','VET','RECEPTIONIST','PHARMACIST')")
    public List<Pet> listPets(){ return pawCareService.getAllPets(); }

    @GetMapping("/pets/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','VET','RECEPTIONIST','PHARMACIST')")
    public ResponseEntity<Pet> getPet(@PathVariable long id){
        return pawCareService.getPetById(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/pets")
    @PreAuthorize("hasAnyRole('ADMIN','VET','RECEPTIONIST')")
    public Pet createPet(@RequestBody Pet p){
        if (p.getProcedures() == null) p.setProcedures(new ArrayList<>());
        return pawCareService.savePet(p);
    }

    @PutMapping("/pets/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','VET','RECEPTIONIST')")
    public ResponseEntity<Pet> updatePet(@PathVariable long id, @RequestBody Pet p){
        if (pawCareService.getPetById(id).isEmpty()) return ResponseEntity.notFound().build();
        // Ensure ID from path is used
        p.setId(id);
        if (p.getProcedures() == null) p.setProcedures(new ArrayList<>());
        return ResponseEntity.ok(pawCareService.updatePet(id, p));
    }

    @DeleteMapping("/pets/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','VET')")
    public ResponseEntity<Void> deletePet(@PathVariable long id, @AuthenticationPrincipal PawCareUserDetails principal){
        if (pawCareService.getPetById(id).isEmpty()) return ResponseEntity.notFound().build();
        // Receptionist cannot delete pets - only Admin and Vet
        String role = principal != null ? principal.getUser().getRole() : "";
        if ("RECEPTIONIST".equalsIgnoreCase(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        pawCareService.deletePet(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value="/pets/{id}/photo", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String,String>> uploadPhoto(@PathVariable long id,
                      @RequestPart("file") MultipartFile file) throws IOException {
        Pet pet = pawCareService.getPetById(id).orElse(null);
        if (pet == null) return ResponseEntity.notFound().build();

        String filename = System.currentTimeMillis() + "_" +
                StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
        Path dest = Path.of(uploadDir, filename);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);
        pet.setPhoto("/uploads/" + filename);
        pawCareService.updatePet(id, pet);
        return ResponseEntity.ok(Map.of("url", pet.getPhoto()));
    }

    @PostMapping("/pets/{id}/procedures")
    public ResponseEntity<Pet> addProcedure(@PathVariable long id, @RequestBody Procedure proc){
        try {
            Pet pet = pawCareService.addProcedureToPet(id, proc);
            return ResponseEntity.ok(pet);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/procedures/catalog")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','VET','PHARMACIST')")
    public Map<String, List<ProcedureTemplate>> procedureCatalog(){
        return procedureCatalogService.all().stream()
                .collect(Collectors.groupingBy(
                        ProcedureTemplate::category,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    /* --------- Appointments --------- */
    @GetMapping("/appointments")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','VET')")
    public List<Appointment> listAppts(@AuthenticationPrincipal PawCareUserDetails principal,
                                       @RequestParam(required=false) String vet,
                                       @RequestParam(required=false) Boolean unassigned){
        List<Appointment> all = pawCareService.getAllAppointments();
        String role = principal.getUser().getRole();
        Long userId = principal.getUser().getId();
        
        // Vets can only see appointments assigned to them (by assignedVetId)
        if ("vet".equalsIgnoreCase(role)) {
            return all.stream()
                    .filter(a -> userId.equals(a.getAssignedVetId()))
                    .toList();
        }
        
        // Admin and Receptionist can see all, but can filter
        if (vet != null && !vet.isBlank()) {
            all = all.stream().filter(a -> vet.equalsIgnoreCase(Objects.toString(a.getVet(), ""))).toList();
        }
        if (Boolean.TRUE.equals(unassigned)) {
            all = all.stream().filter(a -> a.getAssignedVetId() == null || a.getVetUsername() == null || a.getVetUsername().isBlank()).toList();
        }
        return all;
    }

    @PostMapping("/appointments")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','VET')")
    public Appointment createAppt(@RequestBody Appointment a, @AuthenticationPrincipal PawCareUserDetails principal){
        return pawCareService.saveAppointment(a, principal.getUser());
    }

    @PutMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','VET')")
    public ResponseEntity<Appointment> updateAppt(@PathVariable long id,
                                                  @RequestBody Appointment a,
                                                  @AuthenticationPrincipal PawCareUserDetails principal){
        try {
            if (pawCareService.getAppointmentById(id).isEmpty()) return ResponseEntity.notFound().build();
            // Ensure ID from path is used
            a.setId(id);
            return ResponseEntity.ok(pawCareService.updateAppointment(id, a, principal.getUser()));
        } catch (IllegalArgumentException ex) {
            // Return 400 for validation errors, not 403
            return ResponseEntity.badRequest().build();
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/appointments/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','VET')")
    public ResponseEntity<Appointment> approve(@PathVariable long id, @AuthenticationPrincipal PawCareUserDetails principal){
        try {
            Appointment appointment = pawCareService.approveAppointment(id, principal.getUser());
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/appointments/{id}/done")
    @PreAuthorize("hasAnyRole('ADMIN','VET')")
    public ResponseEntity<Appointment> done(@PathVariable long id, @AuthenticationPrincipal PawCareUserDetails principal){
        try {
            Appointment appointment = pawCareService.markAppointmentDone(id, principal.getUser());
            return ResponseEntity.ok(appointment);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','VET')")
    public ResponseEntity<Void> deleteAppt(@PathVariable long id, @AuthenticationPrincipal PawCareUserDetails principal){
        if (pawCareService.getAppointmentById(id).isEmpty()) return ResponseEntity.notFound().build();
        try {
            pawCareService.deleteAppointment(id, principal.getUser());
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            // Return 400 for validation errors (e.g., vet trying to delete another vet's appointment)
            return ResponseEntity.badRequest().build();
        }
    }

    /* --------- Prescriptions --------- */
    @GetMapping("/prescriptions")
    @PreAuthorize("hasAnyRole('ADMIN','VET','PHARMACIST')")
    public List<Prescription> listRx(){ return pawCareService.getAllPrescriptions(); }

    @GetMapping("/prescriptions/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','VET','PHARMACIST')")
    public ResponseEntity<Prescription> getRx(@PathVariable long id){
        return pawCareService.getPrescriptionById(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/prescriptions")
    @PreAuthorize("hasAnyRole('ADMIN','VET')")
    public Prescription createRx(@RequestBody Prescription r, @AuthenticationPrincipal PawCareUserDetails principal){
        // Set vetId from logged-in user if not provided
        if (r.getVetId() == null && principal != null) {
            r.setVetId(principal.getUser().getId());
        }
        return pawCareService.savePrescription(r);
    }

    @PutMapping("/prescriptions/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','VET')")
    public ResponseEntity<Prescription> updateRx(@PathVariable long id, @RequestBody Prescription r, @AuthenticationPrincipal PawCareUserDetails principal){
        if (pawCareService.getPrescriptionById(id).isEmpty()) return ResponseEntity.notFound().build();
        // Ensure ID from path is used
        r.setId(id);
        // Set vetId if not provided and user is a vet
        if (r.getVetId() == null && principal != null && "VET".equalsIgnoreCase(principal.getUser().getRole())) {
            r.setVetId(principal.getUser().getId());
        }
        return ResponseEntity.ok(pawCareService.updatePrescription(id, r));
    }

    @DeleteMapping("/prescriptions/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','VET')")
    public ResponseEntity<Void> deleteRx(@PathVariable long id){
        if (pawCareService.getPrescriptionById(id).isEmpty()) return ResponseEntity.notFound().build();
        pawCareService.deletePrescription(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/prescriptions/{id}/dispense")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    public ResponseEntity<Prescription> dispense(@PathVariable long id){
        try {
            Prescription prescription = pawCareService.dispensePrescription(id);
            return ResponseEntity.ok(prescription);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /* --------- Users --------- */
    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<User> listUsers(){ return pawCareService.getAllUsers(); }

    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public User createUser(@RequestBody User u){ return pawCareService.saveUser(u); }

    @GetMapping("/users/vets")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public List<User> listVets(){ return pawCareService.getActiveVets(); }

    @PutMapping("/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<User> updateUser(@PathVariable long id, @RequestBody User u){
        if (pawCareService.getUserById(id).isEmpty()) return ResponseEntity.notFound().build();
        // Ensure the ID from path is used
        u.setId(id);
        return ResponseEntity.ok(pawCareService.updateUser(id, u));
    }

    @DeleteMapping("/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable long id){
        if (pawCareService.getUserById(id).isEmpty()) return ResponseEntity.notFound().build();
        pawCareService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    /* --------- Reports & Ops --------- */
    @GetMapping("/ops/log")
    @PreAuthorize("hasRole('ADMIN')")
    public List<OperationLog> opsLog(
            @RequestParam String from,
            @RequestParam String to
    ){
        LocalDate f = LocalDate.parse(from);
        LocalDate t = LocalDate.parse(to);
        return pawCareService.getOperationLogsBetween(f, t);
    }

    @GetMapping("/reports/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ReportSummary summary(@RequestParam String period,
                                 @RequestParam(required=false) String from,
                                 @RequestParam(required=false) String to){
        LocalDate today = LocalDate.now();
        LocalDate start, end;

        switch (period) {
            case "day" -> { start = today; end = today; }
            case "week" -> { start = today.minusDays(6); end = today; }
            case "month" -> { start = today.withDayOfMonth(1); end = today; }
            case "custom" -> {
                start = LocalDate.parse(Objects.requireNonNull(from));
                end   = LocalDate.parse(Objects.requireNonNull(to));
            }
            default -> throw new IllegalArgumentException("Invalid period");
        }

        return pawCareService.generateReportSummary(period, start, end);
    }
}
