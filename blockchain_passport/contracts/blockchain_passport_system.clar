;; Passport System - Clarity Smart Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-already-exists (err u101))
(define-constant err-not-found (err u102))
(define-constant err-unauthorized (err u103))
(define-constant err-expired (err u104))
(define-constant err-invalid (err u105))

;; Data Variables
(define-data-var passport-counter uint u0)
(define-data-var visa-counter uint u0)

;; Define maps for storing passport and visa data
(define-map Passports
    uint
    {
        holder: principal,
        full-name: (string-utf8 100),
        date-of-birth: (string-utf8 10),
        nationality: (string-utf8 50),
        issuance-date: uint,
        expiry-date: uint,
        data-hash: (buff 32),
        is-valid: bool
    }
)

(define-map PassportHolders
    principal
    uint
)

(define-map Visas
    {passport-id: uint, visa-id: uint}
    {
        country: (string-utf8 50),
        issue-date: uint,
        expiry-date: uint,
        is-valid: bool
    }
)

(define-map Issuers
    principal
    bool
)

(define-map Verifiers
    principal
    bool
)