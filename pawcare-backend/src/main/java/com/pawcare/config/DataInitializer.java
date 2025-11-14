package com.pawcare.config;

import com.pawcare.entity.*;
import com.pawcare.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private PetRepository petRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Only initialize if database is empty
        if (petRepository.count() == 0) {
            initializeData();
        }
    }

    private void initializeData() {
        // Create sample pets
        Pet pet1 = new Pet("Choco", "Canine", "Beagle", "Female", 3, "1234-5678", "Maria Santos", "123 Mabini St.", "N/A");
        pet1 = petRepository.save(pet1);

        Pet pet2 = new Pet("Mimi", "Feline", "Persian", "Male", 2, "2233-4455", "John Dela Cruz", "45 Narra St.", "FCCI");
        pet2 = petRepository.save(pet2);

        // Create sample appointments
        Appointment appointment1 = new Appointment(pet1.getId(), pet1.getOwner(), LocalDate.now().plusDays(2), "10:00", "drcruz", "Dr. Cruz", "Pending");
        appointmentRepository.save(appointment1);

        // Create sample prescriptions
        Prescription prescription1 = new Prescription(pet1.getId(), pet1.getName(), pet1.getOwner(), "Amoxicillin", "250 mg", "Twice daily", "Dr. Cruz", LocalDate.now());
        prescriptionRepository.save(prescription1);

        // Create sample users
        createOrUpdateUser("admin", "Admin", "admin", "admin123", "admin@pawcare.local");
        createOrUpdateUser("drcruz", "Dr. Cruz", "vet", "vet12345", "vet@pawcare.local");
        createOrUpdateUser("daisy", "Daisy", "receptionist", "frontdesk123", "reception@pawcare.local");
        createOrUpdateUser("paul", "Paul", "pharmacist", "pharma123", "pharma@pawcare.local");
    }

    private void createOrUpdateUser(String username, String name, String role, String password, String email) {
        User user = userRepository.findByUsernameIgnoreCase(username).orElseGet(() -> new User(username, name, role));
        user.setUsername(username);
        user.setName(name);
        user.setRole(role);
        user.setEmail(email);
        user.setActive(true);
        user.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(user);
    }
}

