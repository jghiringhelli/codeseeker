// Go: HTTP handler using interface-based dependency injection
// Paradigm: Interface composition, context propagation, constructor injection
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

// UserService defines the contract the handler depends on.
// Any concrete implementation (DB, cache, mock) satisfies this interface.
type UserService interface {
	GetUser(ctx context.Context, id string) (*User, error)
	CreateUser(ctx context.Context, req CreateUserRequest) (*User, error)
	UpdateUser(ctx context.Context, id string, req UpdateUserRequest) (*User, error)
	DeleteUser(ctx context.Context, id string) error
}

// User is the domain model returned by the service layer.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Roles     []string  `json:"roles"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateUserRequest is the request body for POST /users.
type CreateUserRequest struct {
	Email    string   `json:"email"`
	Username string   `json:"username"`
	Password string   `json:"password"`
	Roles    []string `json:"roles,omitempty"`
}

// UpdateUserRequest is the request body for PATCH /users/:id.
type UpdateUserRequest struct {
	Email    *string  `json:"email,omitempty"`
	Username *string  `json:"username,omitempty"`
	Roles    []string `json:"roles,omitempty"`
}

// UserHandler is an HTTP handler that delegates to UserService.
type UserHandler struct {
	service UserService
}

// NewUserHandler constructs a UserHandler with its dependency injected.
func NewUserHandler(svc UserService) *UserHandler {
	return &UserHandler{service: svc}
}

// GetUser handles GET /users/:id
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := h.service.GetUser(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// CreateUser handles POST /users
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, err := h.service.CreateUser(r.Context(), req)
	if err != nil {
		var validErr *ValidationError
		if errors.As(err, &validErr) {
			writeError(w, http.StatusUnprocessableEntity, validErr.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

// ValidationError is returned when request data fails domain validation.
type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
