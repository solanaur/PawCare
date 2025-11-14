package com.pawcare.web;

import com.pawcare.entity.User;
import com.pawcare.repository.UserRepository;
import com.pawcare.security.JwtService;
import com.pawcare.security.PawCareUserDetails;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
            PawCareUserDetails principal = (PawCareUserDetails) authentication.getPrincipal();
            User user = principal.getUser();
            if (!user.isActive()) {
                throw new BadCredentialsException("User inactive");
            }
            String token = jwtService.generateToken(
                    user.getUsername(),
                    Map.of(
                            "role", user.getRole(),
                            "name", user.getName(),
                            "userId", user.getId()
                    )
            );
            return ResponseEntity.ok(Map.of(
                    "token", token,
                    "user", Map.of(
                            "id", user.getId(),
                            "username", user.getUsername(),
                            "name", user.getName(),
                            "role", user.getRole(),
                            "email", user.getEmail()
                    )
            ));
        } catch (BadCredentialsException ex) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid username or password"));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest request) {
        User user = userRepository.findByUsernameIgnoreCase(request.username())
                .orElseThrow(() -> new BadCredentialsException("User not found"));
        if (!passwordEncoder.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid current password");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record ChangePasswordRequest(@NotBlank String username,
                                        @NotBlank String oldPassword,
                                        @NotBlank String newPassword) {}
}


