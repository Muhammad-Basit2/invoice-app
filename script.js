// --- 1. INDEXEDDB ENGINE CORE ---
let db = null;
const DB_NAME = "SleekPOS_LocalDatabase";
const DB_VERSION = 1;

function initDatabase() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => console.error("Database connection failure", e);
    
    request.onupgradeneeded = (e) => {
        const databaseInstance = e.target.result;
        // Create an object store for stock items using "id" as auto-increment key
        const store = databaseInstance.createObjectStore("inventory", { keyPath: "id", autoIncrement: true });
        store.createIndex("search_idx", ["name", "urduName"]);
        
        // Populate standard sample startup retail stocks initially
        store.add({ name: "Shan Biryani Masala", urduName: "شان بریانی مصالحہ", price: 130, stock: 45 });
        store.add({ name: "Olper's Milk 1L", urduName: "اولپرز دودھ", price: 295, stock: 12 });
    };

    request.onsuccess = (e) => {
        db = e.target.result;
        loadInventoryFromDB(); // Render system assets instantly on bootup
    };
}

// Fetch list values securely from internal database object store
function loadInventoryFromDB() {
    const transaction = db.transaction(["inventory"], "readonly");
    const store = transaction.objectStore("inventory");
    const request = store.getAll();

    request.onsuccess = () => {
        renderInventoryTable(request.result);
    };
}

// Write or append target entries straight into browser storage layer
function insertItemToDB(item) {
    const transaction = db.transaction(["inventory"], "readwrite");
    const store = transaction.objectStore("inventory");
    const request = store.add(item);
    
    request.onsuccess = () => {
        loadInventoryFromDB(); // Hot refresh view values
    };
}

// Deduct item values atomically upon successful sale execution runs
function updateItemStockInDB(id, itemsDeductedQty) {
    const transaction = db.transaction(["inventory"], "readwrite");
    const store = transaction.objectStore("inventory");
    
    const getRequest = store.get(Number(id));
    getRequest.onsuccess = () => {
        const record = getRequest.result;
        if(record) {
            record.stock = Math.max(0, record.stock - itemsDeductedQty);
            store.put(record);
        }
    };
}

// --- 2. RETAIL APPLICATION STATE LOGIC ---
let cart = [];
const inventoryRowsContainer = document.getElementById('inventory-rows');
const invoiceItemsContainer = document.getElementById('invoice-items-container');
const themeToggleBtn = document.getElementById('theme-toggle');
const productForm = document.getElementById('product-form');
const searchInput = document.getElementById('search-input');
const billSubtotalEl = document.getElementById('bill-subtotal');
const billTotalEl = document.getElementById('bill-total');

// Fire system boot engines
document.addEventListener("DOMContentLoaded", initDatabase);

// Dark Mode Controller
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    themeToggleBtn.innerHTML = document.body.classList.contains('dark-theme') ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// Render Product rows inside view component layout
function renderInventoryTable(itemsArray) {
    inventoryRowsContainer.innerHTML = "";
    itemsArray.forEach(item => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', item.id);
        row.innerHTML = `
            <td>#${item.id}</td>
            <td class="product-cell">
                <span class="product-name">${item.name}</span>
                <span class="product-urdu">${item.urduName || ''}</span>
            </td>
            <td>Rs. <span class="p-price">${item.price}</span></td>
            <td><span class="stock-badge ${item.stock <= 5 ? 'low-stock' : 'in-stock'}"><span class="p-stock">${item.stock}</span> left</span></td>
            <td style="text-align: right;"><button class="btn btn-action add-to-bill-btn">+ Add to Bill</button></td>
        `;
        inventoryRowsContainer.appendChild(row);
    });
}

// Add Item Entry Form submission engine
productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newItem = {
        name: document.getElementById('form-name').value,
        urduName: document.getElementById('form-urdu').value,
        price: parseInt(document.getElementById('form-price').value),
        stock: parseInt(document.getElementById('form-stock').value)
    };
    insertItemToDB(newItem);
    productForm.reset();
});

// Real-time local smart searching engine
searchInput.addEventListener('input', function() {
    const filter = this.value.toLowerCase();
    const rows = inventoryRowsContainer.querySelectorAll('tr');
    
    rows.forEach(row => {
        const eng = row.querySelector('.product-name').textContent.toLowerCase();
        const urd = row.querySelector('.product-urdu').textContent.toLowerCase();
        row.style.display = (eng.includes(filter) || urd.includes(filter)) ? "" : "none";
    });
});

// Handle item clicks to pack cart items list values
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-to-bill-btn')) {
        const row = e.target.closest('tr');
        const id = row.getAttribute('data-id');
        const name = row.querySelector('.product-name').textContent;
        const urduName = row.querySelector('.product-urdu').textContent;
        const price = parseInt(row.querySelector('.p-price').textContent);
        const stockEl = row.querySelector('.p-stock');
        let currentStock = parseInt(stockEl.textContent);

        if (currentStock <= 0) { alert("Out of Stock in database!"); return; }

        // Live visual subtraction 
        currentStock--;
        stockEl.textContent = currentStock;
        if(currentStock <= 5) row.querySelector('.stock-badge').className = "stock-badge low-stock";

        const existing = cart.find(item => item.id === id);
        if (existing) {
            existing.qty++;
            existing.totalAmount += price;
        } else {
            cart.push({ id, name, urduName, price, qty: 1, totalAmount: price });
        }
        renderInvoiceView();
    }
});

function renderInvoiceView() {
    invoiceItemsContainer.innerHTML = `<div class="invoice-item header"><span>Item Description</span><span style="text-align: center;">Qty</span><span style="text-align: right;">Amount</span></div>`;
    let total = 0;
    cart.forEach(item => {
        total += item.totalAmount;
        const row = document.createElement('div');
        row.className = 'invoice-item';
        row.innerHTML = `<span>${item.name}</span><span style="text-align: center;">${item.qty}</span><span style="text-align: right;">Rs. ${item.totalAmount}</span>`;
        invoiceItemsContainer.appendChild(row);
    });
    billSubtotalEl.textContent = total;
    billTotalEl.textContent = total;
}

// Radio check active class updater logic
document.querySelectorAll('.method-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    });
});

document.getElementById('clear-bill').addEventListener('click', () => { cart = []; renderInvoiceView(); loadInventoryFromDB(); });

// --- 4. PRINT CUSTOMIZER ENGINE SETUP ---
document.getElementById('checkout-bill').addEventListener('click', () => {
    if (cart.length === 0) { alert("No items active inside billing queue."); return; }

    // Read values live straight from customizer interface panels configuration
    const storeName = document.getElementById('cfg-store-name').value;
    const storeAddress = document.getElementById('cfg-store-address').value;
    const storePhone = document.getElementById('cfg-store-phone').value;
    const chosenWidth = document.getElementById('cfg-paper-width').value;
    
    const customerName = document.getElementById('cust-name').value || "Walk-In Customer";
    const customerPhone = document.getElementById('cust-phone').value || "N/A";
    const paymentMode = document.querySelector('input[name="payment"]:checked').value;

    // Apply custom paper width configuration settings to target receipt block element module
    const receiptBox = document.getElementById('print-receipt');
    receiptBox.style.width = chosenWidth;

    // Inject variable customization points elements straight into template
    document.getElementById('prnt-store-name').textContent = storeName;
    document.getElementById('prnt-store-address').textContent = storeAddress;
    document.getElementById('prnt-store-phone').textContent = "Ph: " + storePhone;
    
    document.getElementById('print-inv-id').textContent = Math.floor(10000 + Math.random() * 90000);
    document.getElementById('print-date-time').textContent = new Date().toLocaleString('en-PK');
    document.getElementById('print-cust-name').textContent = customerName;
    document.getElementById('print-cust-phone').textContent = customerPhone;
    document.getElementById('print-payment-mode').textContent = paymentMode;

    const printBody = document.getElementById('print-items-body');
    printBody.innerHTML = "";

    cart.forEach(item => {
        // Decrement database values permanently
        updateItemStockInDB(item.id, item.qty);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div>${item.name}</div>
                ${item.urduName ? `<small class="receipt-print-urdu">${item.urduName}</small>` : ''}
            </td>
            <td style="text-align: center;">${item.qty}</td>
            <td style="text-align: right;">Rs. ${item.totalAmount}</td>
        `;
        printBody.appendChild(row);
    });

    document.getElementById('print-total').textContent = billTotalEl.textContent;

    // Fire hardware execution trigger interface hook
    window.print();

    // Reset clean states post-sale execution runs
    cart = [];
    document.getElementById('cust-name').value = "";
    document.getElementById('cust-phone').value = "";
    renderInvoiceView();
    setTimeout(loadInventoryFromDB, 500); // Trigger clean database data sync load
});