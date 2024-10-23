;; Digital Passport System
;; Written in Clarity for Stacks Blockchain
;; Error codes:
;; (err u1) - Unauthorized
;; (err u2) - Invalid input
;; (err u3) - Already exists
;; (err u4) - Not found
;; (err u5) - Expired or invalid
;; (err u6) - Operation failed

(define-constant contract-owner tx-sender)
(define-constant err-unauthorized (err u1))
(define-constant err-invalid-input (err u2))
(define-constant err-already-exists (err u3))
(define-constant err-not-found (err u4))
(define-constant err-invalid (err u5))
(define-constant err-operation-failed (err u6))

;; Data Maps
(define-map Passports
    {passport-id: (string-utf8 32)}
    {
        holder: principal,
        full-name: (string-utf8 100),
        date-of-birth: uint,
        nationality: (string-utf8 50),
        issue-date: uint,
        expiry-date: uint,
        is-valid: bool,
        metadata-url: (optional (string-utf8 256))
    }
)

(define-map PassportAuthorities
    principal
    {
        name: (string-utf8 100),
        active: bool,
        authorized-since: uint
    }
)

(define-map HolderPassports
    principal
    (string-utf8 32)
)

;; Storage of passport numbers to prevent duplicates
(define-map PassportNumbers
    (string-utf8 32)
    bool
)

;; Read-only functions
(define-read-only (get-passport (passport-id (string-utf8 32)))
    (map-get? Passports {passport-id: passport-id})
)

(define-read-only (get-holder-passport (holder principal))
    (map-get? HolderPassports holder)
)

(define-read-only (is-valid-passport? (passport-id (string-utf8 32)))
    (match (map-get? Passports {passport-id: passport-id})
        passport (and 
            (get is-valid passport)
            (> (get expiry-date passport) block-height)
        )
        false
    )
)

(define-read-only (is-authority (address principal))
    (match (map-get? PassportAuthorities address)
        authority (get active authority)
        false
    )
)

;; Public functions

(define-public (add-authority (authority-address principal) (authority-name (string-utf8 100)))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-unauthorized)
        (asserts! (is-none (map-get? PassportAuthorities authority-address)) err-already-exists)
        
        (map-set PassportAuthorities
            authority-address
            {
                name: authority-name,
                active: true,
                authorized-since: block-height
            }
        )
        (ok true)
    )
)
