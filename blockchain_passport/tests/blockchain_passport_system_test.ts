import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that contract owner can add passport authorities",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("United States Passport Agency")
                ],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify authority was added
        const isAuthority = chain.callReadOnlyFn(
            'digital-passport-system',
            'is-authority',
            [types.principal(authority.address)],
            deployer.address
        );

        assertEquals(isAuthority.result, 'true');
    },
});

Clarinet.test({
    name: "Ensure that non-owner cannot add passport authorities",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const user = accounts.get('wallet_1')!;
        const newAuthority = accounts.get('wallet_2')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(newAuthority.address),
                    types.utf8("Unauthorized Authority")
                ],
                user.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u1)'); // err-unauthorized
    },
});

Clarinet.test({
    name: "Ensure that contract owner can remove passport authorities",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("European Union Passport Office")
                ],
                deployer.address
            )
        ]);

        // Now remove the authority
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'remove-authority',
                [types.principal(authority.address)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify authority was deactivated
        const isAuthority = chain.callReadOnlyFn(
            'digital-passport-system',
            'is-authority',
            [types.principal(authority.address)],
            deployer.address
        );

        assertEquals(isAuthority.result, 'false');
    },
});

Clarinet.test({
    name: "Ensure that authorities can issue passports",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;
        const holder = accounts.get('wallet_2')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("Canadian Passport Office")
                ],
                deployer.address
            )
        ]);

        // Issue a passport
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("ABC123456"),
                    types.principal(holder.address),
                    types.utf8("John Doe"),
                    types.uint(19851015), // Date of birth YYYYMMDD
                    types.utf8("Canada"),
                    types.uint(14400), // Validity period in blocks (approx. 100 days)
                    types.some(types.utf8("https://example.com/passport/metadata/ABC123456"))
                ],
                authority.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify passport details
        const passport = chain.callReadOnlyFn(
            'digital-passport-system',
            'get-passport',
            [types.utf8("ABC123456")],
            deployer.address
        );

        const passportData = passport.result.expectSome().expectTuple();
        assertEquals(passportData['holder'], holder.address);
        assertEquals(passportData['full-name'], types.utf8("John Doe"));
        assertEquals(passportData['nationality'], types.utf8("Canada"));
        assertEquals(passportData['is-valid'], 'true');

        // Verify the passport is marked as valid
        const isValid = chain.callReadOnlyFn(
            'digital-passport-system',
            'is-valid-passport?',
            [types.utf8("ABC123456")],
            deployer.address
        );

        assertEquals(isValid.result, 'true');
    },
});

Clarinet.test({
    name: "Ensure that non-authorities cannot issue passports",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const nonAuthority = accounts.get('wallet_1')!;
        const holder = accounts.get('wallet_2')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("XYZ123456"),
                    types.principal(holder.address),
                    types.utf8("Jane Doe"),
                    types.uint(19901120), // Date of birth YYYYMMDD
                    types.utf8("United States"),
                    types.uint(14400), // Validity period in blocks
                    types.none()
                ],
                nonAuthority.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u1)'); // err-unauthorized
    },
});

Clarinet.test({
    name: "Ensure that authorities can revoke passports",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;
        const holder = accounts.get('wallet_2')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("Australian Passport Office")
                ],
                deployer.address
            )
        ]);

        // Issue a passport
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("DEF789012"),
                    types.principal(holder.address),
                    types.utf8("Alice Smith"),
                    types.uint(19780305), // Date of birth YYYYMMDD
                    types.utf8("Australia"),
                    types.uint(14400), // Validity period in blocks
                    types.none()
                ],
                authority.address
            )
        ]);

        // Revoke the passport
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'revoke-passport',
                [types.utf8("DEF789012")],
                authority.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify the passport is marked as invalid
        const isValid = chain.callReadOnlyFn(
            'digital-passport-system',
            'is-valid-passport?',
            [types.utf8("DEF789012")],
            deployer.address
        );

        assertEquals(isValid.result, 'false');
    },
});

Clarinet.test({
    name: "Ensure that authorities can update passport metadata",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;
        const holder = accounts.get('wallet_2')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("UK Passport Office")
                ],
                deployer.address
            )
        ]);

        // Issue a passport
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("GHI345678"),
                    types.principal(holder.address),
                    types.utf8("Robert Johnson"),
                    types.uint(19830712), // Date of birth YYYYMMDD
                    types.utf8("United Kingdom"),
                    types.uint(14400), // Validity period in blocks
                    types.some(types.utf8("https://example.com/passport/metadata/GHI345678/old"))
                ],
                authority.address
            )
        ]);

        // Update passport metadata
        const newMetadataUrl = "https://example.com/passport/metadata/GHI345678/new";
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'update-passport-metadata',
                [
                    types.utf8("GHI345678"),
                    types.some(types.utf8(newMetadataUrl))
                ],
                authority.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify metadata was updated
        const passport = chain.callReadOnlyFn(
            'digital-passport-system',
            'get-passport',
            [types.utf8("GHI345678")],
            deployer.address
        );

        const passportData = passport.result.expectSome().expectTuple();
        const metadataUrl = passportData['metadata-url'].expectSome();
        assertEquals(metadataUrl, types.utf8(newMetadataUrl));
    },
});

Clarinet.test({
    name: "Ensure that authorities can extend passport validity",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;
        const holder = accounts.get('wallet_2')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("French Passport Office")
                ],
                deployer.address
            )
        ]);

        // Issue a passport
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("JKL901234"),
                    types.principal(holder.address),
                    types.utf8("Marie Dupont"),
                    types.uint(19951230), // Date of birth YYYYMMDD
                    types.utf8("France"),
                    types.uint(10000), // Initial validity period
                    types.none()
                ],
                authority.address
            )
        ]);

        // Get the initial expiry date
        let passport = chain.callReadOnlyFn(
            'digital-passport-system',
            'get-passport',
            [types.utf8("JKL901234")],
            deployer.address
        );

        const initialData = passport.result.expectSome().expectTuple();
        const initialExpiry = initialData['expiry-date'];

        // Extend passport validity
        const extensionPeriod = 5000; // Additional blocks
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'extend-passport-validity',
                [
                    types.utf8("JKL901234"),
                    types.uint(extensionPeriod)
                ],
                authority.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify expiry date was extended
        passport = chain.callReadOnlyFn(
            'digital-passport-system',
            'get-passport',
            [types.utf8("JKL901234")],
            deployer.address
        );

        const updatedData = passport.result.expectSome().expectTuple();
        const newExpiry = updatedData['expiry-date'];

        // Check that the new expiry is equal to initial expiry + extension period
        assertEquals(newExpiry, types.uint(Number(initialExpiry.substring(1)) + extensionPeriod));
    },
});

Clarinet.test({
    name: "Ensure that duplicate passport IDs are rejected",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;
        const holder1 = accounts.get('wallet_2')!;
        const holder2 = accounts.get('wallet_3')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("German Passport Office")
                ],
                deployer.address
            )
        ]);

        // Issue first passport
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("MNO567890"),
                    types.principal(holder1.address),
                    types.utf8("Hans Schmidt"),
                    types.uint(19881105), // Date of birth YYYYMMDD
                    types.utf8("Germany"),
                    types.uint(14400), // Validity period in blocks
                    types.none()
                ],
                authority.address
            )
        ]);

        // Try to issue a passport with the same ID
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("MNO567890"), // Same passport ID
                    types.principal(holder2.address),
                    types.utf8("Helmut Wagner"),
                    types.uint(19900203), // Date of birth YYYYMMDD
                    types.utf8("Germany"),
                    types.uint(14400), // Validity period in blocks
                    types.none()
                ],
                authority.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u3)'); // err-already-exists
    },
});

Clarinet.test({
    name: "Ensure that holders can only have one passport",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;
        const holder = accounts.get('wallet_2')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("Italian Passport Office")
                ],
                deployer.address
            )
        ]);

        // Issue first passport
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("PQR123789"),
                    types.principal(holder.address),
                    types.utf8("Marco Rossi"),
                    types.uint(19750815), // Date of birth YYYYMMDD
                    types.utf8("Italy"),
                    types.uint(14400), // Validity period in blocks
                    types.none()
                ],
                authority.address
            )
        ]);

        // Try to issue another passport to the same holder
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8("STU456012"), // Different passport ID
                    types.principal(holder.address), // Same holder
                    types.utf8("Marco Rossi"),
                    types.uint(19750815), // Date of birth YYYYMMDD
                    types.utf8("Italy"),
                    types.uint(14400), // Validity period in blocks
                    types.none()
                ],
                authority.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u3)'); // err-already-exists
    },
});

Clarinet.test({
    name: "Ensure get-holder-passport returns the correct passport ID",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const authority = accounts.get('wallet_1')!;
        const holder = accounts.get('wallet_2')!;

        // First add the authority
        let block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'add-authority',
                [
                    types.principal(authority.address),
                    types.utf8("Japanese Passport Office")
                ],
                deployer.address
            )
        ]);

        // Issue a passport
        const passportId = "VWX789345";
        block = chain.mineBlock([
            Tx.contractCall(
                'digital-passport-system',
                'issue-passport',
                [
                    types.utf8(passportId),
                    types.principal(holder.address),
                    types.utf8("Takashi Yamamoto"),
                    types.uint(19911225), // Date of birth YYYYMMDD
                    types.utf8("Japan"),
                    types.uint(14400), // Validity period in blocks
                    types.none()
                ],
                authority.address
            )
        ]);

        // Get the passport ID for the holder
        const holderPassport = chain.callReadOnlyFn(
            'digital-passport-system',
            'get-holder-passport',
            [types.principal(holder.address)],
            deployer.address
        );

        assertEquals(holderPassport.result, types.some(types.utf8(passportId)));
    },
});