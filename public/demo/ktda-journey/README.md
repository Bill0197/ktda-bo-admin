# KTDA farmer journey: demo files

Five test farmers, the same growers through all three steps of the farmer
journey (Farmer journey in the back office):

1. `1-register.csv`: step 1, register farmers (flow REGISTRATION).
2. `2-activate.csv`: step 2, farmer onboarding simulated (flow ACTIVATION),
   which opens each farmer's KES wallet.
3. `3-fund.csv`: step 3, fund wallets (flow PAYMENT). Total KES 10,000.75.

All of it is test data: grower numbers TEST000001 to TEST000005, names "Test
Farmer One" to "Five", national IDs 90000001 to 90000005, ID references
TEST-ID-*, payment references TEST-PAY-*. The phone numbers 254700000101 to
254700000105 are shaped like real Kenyan mobiles (the backend checks the
format); before any upload to a shared environment, confirm they are numbers
the test environment does not send real SMS to.

Steps 1 and 2 find their columns by header name, in any order, and ignore
extra columns: step 1 needs grower_no, full_name and msisdn (factory and
national_id optional); step 2 needs grower_no, and national_id unless step 1
gave one (date_of_birth as YYYY-MM-DD, id_document_ref optional). Step 3 reads
its three columns by position. No value may contain a comma. The full
contract is in src/lib/journeyContract.ts.
