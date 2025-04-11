/***
 *
 * Copyright (c) 2019-2024 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



/*** 
 * 
 * Handles interacting w Stripe and Firebase for subscription and purchase management.
 * 
 *   initializeFirebase, signIn to get or create a new anonymous fb account, 
 *   getSub to get the users sub from fb account. subscribe() w product key
 *   and manage via the url from getStripePortalURL.
 * 
 ***/

var BTId;
const FBENV = "prod"; // "local" or "test" or "prod"
const LocalFB = (FBENV == "local");
const TestFB = (FBENV == "test");

async function handlePurchase(product) {
    // handle monthly or annual subscribe. Load Stripe code, load and init FB, check for existing sub or purchase, then pass to Stripe to complete txn
    
    if (configManager.getProp('BTManagerHome') == "SIDEPANEL") {
        alert("Unfortunately purchasing is not currently supported in the side panel. \n\nPlease set the Topic Manager Location to Window or Tab to make a purchase.");
        return;
    }
    // First Check if Stripe script is already loaded
    try {
        if (!window.Stripe) {
            // Load Stripe script
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
    
            const loadPromise = new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
    
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Script load timed out')), 10000); // 10 second timeout
            });
    
            document.head.appendChild(script);
    
            // Wait for the script to load or timeout
            await Promise.race([loadPromise, timeoutPromise]);
        }
        FBDB || await initializeFirebase();
        if (!FBDB) {
            console.error("Problem initializing Firebase");
            alert("Sorry Firebase initialization failed.");
            return;
        }
    } catch(error) {
        console.error("Error initializing Stripe/Firebase: ", error);
        alert("Sorry Stripe/Firebase initialization failed.");
        return;
    }

    if (!confirm("You will now be forwarded to Stripe to confirm payment details to Data Foundries LLC (BrainTool's incorporated name).\n\nAfter that BT will reload with your supporter status in place.\n\nNB coupons can be applied at purchase.\nForwarding might take several seconds."))
	    return;
    $('body').addClass('waiting');

    // Create user id, store in localStore and in BTFile text
    try {
        BTId = await signIn();
        if (!BTId) {
            $('body').removeClass('waiting');
            console.error("Error signing in to FB");
            alert("Sorry Firebase user creation failed.");
            return;
        }
    } catch(error) {
        $('body').removeClass('waiting');
        console.error("Error signing in FB user:", error);
        alert("Sorry Firebase user creation failed.");
        return;
    }
    // Save sub id as BTId in local storage and org file property
    configManager.setProp('BTId', BTId);
    $('body').removeClass('waiting');
    await saveBT();

    if (product != OTP) {
        // handle subscriptions different than one time purchase
        let subscription = await getPurchase('subscriptions');
        if (subscription) {
	        alert("Seems like you already have a subscription associated with this browser. Close and restart BrainTool.");
	        //console.log("Subscription exists for this user:", JSON.stringify(subscription));
	        return;
        }    
        // Create sub - redirects to Stripe, so execution will end here.
        // on reload the BTId value set above will indicate a premium subscription
        subscribe(product);
    } else {
        // handle one time purchase
        let myproduct = await getPurchase('payments');
        if (myproduct) {
	        alert("Seems like you already have a license associated with this browser. Close and restart BrainTool.");
	        //console.log("License exists for this user:", JSON.stringify(myproduct));
	        return;
        }    
        // redirects to Stripe, so execution will end here.
        // on reload the BTId value set above will indicate a purchase
        purchase(product);
    }
}

async function openStripePortal() {
    // open page to manage subscription
    if (!BTId) {
	    alert('BrainTool Id not set!');
	    return;
    }
    alert("Opening Stripe portal to manage your subscription. This may take a few seconds.");
    const url = await getStripePortalURL();
    window.open(url, '_blank');
}

// https://dashboard.stripe.com/tax-rates
const taxRates = [];

// https://dashboard.stripe.com/apikeys
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Config values generated by FB app console
// config for prod v local emulator for testing
let firebaseConfig, Annual, Monthly, OTP;
// prod config
firebaseConfig = {
    authDomain: "mybraintool-42.firebaseapp.com",
    projectId: "mybraintool-42",
    storageBucket: "mybraintool-42.appspot.com",
    messagingSenderId: "177084785905",
    appId: "1:177084785905:web:305c20b6239b97b3243550"
};
Annual =  "price_1P4TJrJfoHixgzDGQX5G7EYQ";           // test: "price_1P4PTlJfoHixgzDGOkTBFq4s"; 
Monthly =  "price_1P4TJvJfoHixgzDGGuY6orEO";          // test: "price_1P4PRkJfoHixgzDGh1N8UMHA";
OTP = "price_1P4TK1JfoHixgzDGvFvSCdu9";               // test 20.99: "price_1P3kqcJfoHixgzDGJojQ5R3v";

if (LocalFB) {
    // local config
    firebaseConfig = {
        authDomain: "braintool-dev.firebaseapp.com",
        projectId: "braintool-dev",
        storageBucket: "braintool-dev.firebasestorage.app",
        messagingSenderId: "956282384745",
        appId: "1:956282384745:web:a193af18e49f15fea50df8"
    };
    Annual =  "price_1RAHQQJfoHixgzDGLdGkVmG3";
    Monthly =  "price_1RAHQiJfoHixgzDG30Vrw8m1";
    OTP = "price_1RAHQzJfoHixgzDGY5X1aNth";
} 
if (TestFB) {
    // cloud test config
    firebaseConfig = {
        authDomain: "braintool-test.firebaseapp.com",
        projectId: "braintool-test",
        storageBucket: "braintool-test.firebasestorage.app",
        messagingSenderId: "549550947966",
        appId: "1:549550947966:web:2933e62cc33363b5bd622f"
      };
      OTP = "price_1RC727JfoHixgzDGXgDiIlIS";
      Annual = "price_1RC6zlJfoHixgzDGZx7JGp06";
      Monthly = "price_1RC6zNJfoHixgzDGuNAYQFDq";
}

const FunctionLocation = 'us-east1';
let FBDB = null;

async function initializeFirebase() {
    // First load scripts (lazy cos not needed until there's a license check or purchase)
     const firebaseScripts = [
        'https://www.gstatic.com/firebasejs/8.6.5/firebase-app.js',     // must be first
        'https://www.gstatic.com/firebasejs/8.6.5/firebase-functions.js',
        'https://www.gstatic.com/firebasejs/8.6.5/firebase-firestore.js',
        'https://www.gstatic.com/firebasejs/8.6.5/firebase-auth.js',
        // Add other Firebase scripts here...
    ];
    
    // Load each script
    for (const src of firebaseScripts) {
        // Check if script is already loaded
        if (!document.querySelector(`script[src="${src}"]`)) {
            // Create new script element
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            document.head.appendChild(script);
            
            // Wait for the script to load
            await new Promise((resolve) => {
                script.onload = resolve;
            });
        }
    }

    // set API key passed in from config
    const fbKey = configManager.getProp('FB_KEY');
    if (!fbKey) {
        console.error("Firebase api key not set!");
        return;
    }
    firebaseConfig.apiKey = fbKey;

    try {
        const firebaseApp = firebase.initializeApp(firebaseConfig);
        FBDB = firebaseApp.firestore();

        // Connect to emulators when in local development
        if (LocalFB) {
            FBDB.settings({
                host: "localhost:8080",
                ssl: false
            });
            // More explicit emulator connection
            const functions = firebase.app().functions(FunctionLocation);
            functions.useEmulator("localhost", 5001);
            
            // For some Firebase SDK versions, you might need this additional step:
            const createPortalLink = functions.httpsCallable('createPortalLink');
            createPortalLink.origin = "http://localhost:5001";
            
            firebase.auth().useEmulator("http://localhost:9099");            
            console.log("Connected to Firebase emulators");
        }
    }
    catch(error) {
	    var errorCode = error.code;
	    var errorMessage = error.message;
        console.log("ERROR in initializeFirebase:");
	    console.log(errorCode, errorMessage);
    }
}

async function signIn() {
    // return current user if signed in, otherwise return a promise that resolves when
    // a new anonymous user is created
    
    FBDB || await initializeFirebase();
    let uid = firebase.auth()?.currentUser?.uid;
    if (uid) return uid;

    return new Promise(function (resolve) {
	    firebase.auth().signInAnonymously().then(() => {
	        firebase.auth().onAuthStateChanged((firebaseUser) => {
		        if (firebaseUser) resolve(firebaseUser.uid);
	        });
	    }).catch((error) => {
	        var errorCode = error.code;
	        var errorMessage = error.message;
	        console.log(errorCode, errorMessage);
	        resolve(null);
	    });
    });
}
// NB Signout : firebase.auth().signOut();  // need to sign out to create new user during testing

async function checkLicense() {
    // Startup checks for license exists, expired etc

    if(!BTId) {
        console.log("No BTId => no license");
        return false;
    }
    const licenseExpiry = configManager.getProp('BTExpiry');
    if (BTId && licenseExpiry && (Date.now() < licenseExpiry)) {
        console.log("Active license");
        return true;
    }

    // Handle case where user just went thru Stripe flow, it passes back ?purchase=['product', 'subscription' or 'cancelled']
    const urlParams = new URLSearchParams(window.location.search);
    const purchase = urlParams.get('purchase');
    if (purchase == 'cancelled') {
        // need to reset BTId cos a user account was created prior to purchase
        alert('Your purchase was cancelled. No changes were made.');
        BTId = null; configManager.setProp('BTId', null);
        saveBT();
        return false;
    }

    // Either new purchase or expired license or manually copied in from elsewhere => Need to load fb code to check
    // await load fb codebase
    const product = await getPurchase('payments');
    if (product) {
        if (purchase == 'product') alert('You now have a permanent license. Thank you for supporting BrainTool!');
        configManager.setProp('BTExpiry', 8640000000000000);      // max date
        return true;
    }
    const subscription = await getPurchase('subscriptions');
    if (subscription && purchase == 'subscription') {
        alert('Your subscription is now active. Thank you for supporting BrainTool!');
        configManager.setProp('BTExpiry', subscription.current_period_end.seconds * 1000);                // convert to ms for Date
        return true;
    }

    if(!subscription && !product) {
        console.log("BTID set but no purchase or subscription found");
        return false;
    }

    configManager.setProp('BTExpiry', ((subscription?.current_period_end.seconds * 1000) || licenseExpiry));  // Sub exists but maybe expired
    if (Date.now() < configManager.getProp('BTExpiry')) {
        console.log("License renewed");
        return true;
    }
    console.log("License expired");
    alert("Looks like your subscription has expired. Create a new subscription or continue using the free version.");
    return false;
}


async function getPurchase(collection = 'subscriptions') {
    // Get subscription or one time payment record ('payments') for current user
    // NB subs also create payment records on each renewal, so we need to filter for payments with non null item data
    try {
        FBDB || await initializeFirebase();
    } catch(e) {
        console.error("Error initializing Firebase in getPurchase");
        console.log(JSON.stringify(e));
        return null;
    }
    return new Promise((resolve, reject) => {
        try {
            FBDB.collection('customers')
            .doc(BTId)
            .collection(collection)
            .where('status', 'in', ['trialing', 'active', 'succeeded'])
            .onSnapshot((snapshot) => {
                if (snapshot.empty) {
                    console.log(`No active ${collection}!`);
                    resolve(null);
                } else {
                    let result = snapshot.docs[0].data();
                    if (collection === 'payments') {
                        result = snapshot.docs.find(doc => doc.data().items != null)?.data() || null;
                    }
                    //console.log(`Sub: ${JSON.stringify(result)}`);
                    resolve(result);
                }
            });
        } catch(e) {
            console.error("Error in getPurchase");
            console.log(JSON.stringify(e)); 
            reject(e);
        }
    });
}

// Checkout handler
async function subscribe(productPrice) {
    const selectedPrice = {
	    price: productPrice,
	    quantity: 1,
    };
    const baseURL = window.location.href.split('?')[0];     // drop any preexisting '?purchase=xyz' arg
    const checkoutSession = {
	    collect_shipping_address: false,
	    billing_address_collection: 'auto',
	    tax_rates: taxRates,
	    allow_promotion_codes: true,
	    line_items: [selectedPrice],
	    success_url: baseURL + '?purchase=' + encodeURIComponent('subscription'),
	    cancel_url: baseURL + '?purchase=' + encodeURIComponent('cancelled'),
        description: "BrainTool Supporter Subscription ID: " + BTId,
    };
    try {
        const docRef = await FBDB
	          .collection('customers')
	          .doc(BTId)
	          .collection('checkout_sessions')
	          .add(checkoutSession);
        
        // Wait for the CheckoutSession to get attached by the fb extension
        docRef.onSnapshot((snap) => {
	        const { error, sessionId } = snap.data();
	        if (error) {
                $('body').removeClass('waiting');
	            alert(`An error occured: ${error.message}`);
	        }
	        if (sessionId) {
	            // We have a session, let's redirect to Checkout
	            // Init Stripe
                const stripeKey = configManager.getProp('STRIPE_KEY');
	            const stripe = Stripe(stripeKey);
	            stripe.redirectToCheckout({ sessionId });
	        }
        });
    } catch(e) {
        $('body').removeClass('waiting');
        console.error("Error in subscribe with ", productPrice, " Firebase says:");
        console.log(JSON.stringify(e));
    }
}

async function purchase(productPrice) {
    // similar to above but One-Time-purchase
    const baseURL = window.location.href.split('?')[0];     // drop any preexisting '?purchase=xyz' arg
    const checkoutSession = {
        mode: "payment",
        price: OTP,                                         // One-time price created in Stripe
	    allow_promotion_codes: true,
        success_url: baseURL+ '?purchase=' + encodeURIComponent('product'),
        cancel_url: baseURL + '?purchase=' + encodeURIComponent('cancelled'),
        description: "BrainTool Supporter License ID: " + BTId,
    };
    try {
        const docRef = await FBDB.collection("customers").doc(BTId).collection("checkout_sessions").add(checkoutSession);
        // Wait for the CheckoutSession to get attached by the fb extension
        docRef.onSnapshot((snap) => {
	        const { error, sessionId } = snap.data();
	        if (error) {
                $('body').removeClass('waiting');
	            alert(`An error occured: ${error.message}`);
	        }
	        if (sessionId) {
	            // We have a session, let's redirect to Checkout
	            // Init Stripe
                const stripeKey = configManager.getProp('STRIPE_KEY');
	            const stripe = Stripe(stripeKey);
	            stripe.redirectToCheckout({ sessionId });
	        }
        });
    } catch(e) {
        $('body').removeClass('waiting');
        console.error("Error in purchase with ", productPrice, " Firebase says:");
        console.log(JSON.stringify(e));
    }
}

/*
async function RCPurchase(sessionId) {
    // Skip Stripe processing to allow free license for RC. Stripe won't charge 0 for a product or give 100% discount

    const fakePayment = {
        mode: "rc_stripe_bypass",
        amount_total: 0,
        status: "succeeded",
        price: OTP,
        object: "no_payment_intent",
    }
    const docRef = await FBDB.collection("customers").doc(BTId).collection("payments").add(fakePayment);
    // Wait for the fakePayment to get attached by the fb extension
    docRef.onSnapshot((snap) => {
        const { error, sessionId } = snap.data();
        if (error) {
            $('body').removeClass('waiting');
            alert(`An error occured in RCPurchase: ${error.message}`);
            return;
        }
        $('body').removeClass('waiting');
        alert("Your (free) purchase was successful. You now have a permanent license. Thank you for supporting BrainTool!");
        configManager.setProp('BTExpiry', 8640000000000000);      // max date
        updateLicenseSettings();
    });
}
*/

async function getStripePortalURL() {
    // Billing portal handler
    let rsp;
    FBDB || await initializeFirebase();
    try {
	    const functionRef = firebase
	          .app()
	          .functions(FunctionLocation)
	          .httpsCallable('createPortalLink');
	    rsp = await functionRef(
	        { returnUrl: "https://braintool.org", 'BTId': BTId });
    } catch(e) {
        const err = JSON.stringify(e);
	    console.error("Error in getPortal:", err);
        alert("Error accessing Stripe portal:\n", err);
	    return ("https://braintool.org/support");
    }
    return rsp.data.url;
}

async function importKey() {
    const key = prompt('Please enter your license key:');
    if (key) {
        BTId = key;
        if (await checkLicense()) {
            configManager.setProp('BTId', key);
            saveBT();
            alert('License key accepted. Thank you for supporting BrainTool!');
            updateLicenseSettings();
        }
    }
}

