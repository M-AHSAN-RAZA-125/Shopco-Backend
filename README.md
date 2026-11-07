# Shop.Co Backend (matched to your uploaded frontend)

This backend uses the exact eight products and product fields found in your `product.json` and `topSelling.json`.

## Setup
1. Install Node.js 18 or newer.
2. Open this folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Add your MongoDB Atlas URI and a long random JWT secret.
6. Run `npm run seed` once to insert the eight frontend products.
7. Run `npm run dev`.

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

Example `.env`:
```env
PORT=5000
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/shopco?retryWrites=true&w=majority
JWT_SECRET=use_a_long_random_secret_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173,https://your-live-frontend.netlify.app
```

API runs at `http://localhost:5000` (matches the frontend's local default). Check `http://localhost:5000/api/health`.
`MONGO_URI` (or the older name `MONGO_URL`) is the database link. `localhost` origins are allowed automatically in development; `CLIENT_URL` must list your live frontend address in production.
Product images are also served from `/images/...`, but the frontend now loads `/images/...` from its own `public/images` folder.

**Seed warning:** `npm run seed` deletes all existing Product documents before inserting the eight Shop.Co products. Run it only on a fresh/test database.

## Product data compatibility
The API retains your frontend's fields:
`legacyId`, `name`, `price`, `oldPrice`, `discount`, `rating`, `image`, `category`.
Existing numeric product routes work: `/api/products/1`, `/api/products/51`, etc.
The seed script imports all eight records from the two JSON files in the uploaded frontend.

## Routes

All responses use JSON. Protected endpoints require:
`Authorization: Bearer YOUR_TOKEN`

### Authentication
- `POST /api/auth/register` body: `{ "name":"Customer", "email":"customer@example.com", "password":"password123" }`
- `POST /api/auth/login` body: `{ "email":"customer@example.com", "password":"password123" }`
- `GET /api/auth/me` protected

### Products (public GET)
- `GET /api/products`
- `GET /api/products/:id` (supports legacy numeric IDs and MongoDB IDs)
- `GET /api/products?search=shirt`
- `GET /api/products?category=T-shirts`
- `GET /api/products?minPrice=100&maxPrice=250`
- `GET /api/products?sort=price_asc`
- `GET /api/products?sort=price_desc`
- `GET /api/products?sort=newest`
- Admin: `POST`, `PUT /:id`, `DELETE /:id` under `/api/products`

Product create body example:
```json
{
  "name": "New T-shirt",
  "price": 150,
  "oldPrice": 180,
  "discount": "-15%",
  "rating": 4.5,
  "image": "/images/black-t-shirt.png",
  "category": "T-shirts",
  "description": "Product description",
  "sizes": ["Small", "Medium", "Large", "X-Large"],
  "colors": ["Olive", "Teal", "Navy"],
  "stock": 25
}
```

### Categories
- `GET /api/categories`

### Cart (login required)
- `GET /api/cart`
- `POST /api/cart/items` body: `{ "productId": 1, "quantity": 1, "size": "Large", "color": "Olive" }`
- `PATCH /api/cart/items/:itemId` body: `{ "quantity": 2 }`
- `DELETE /api/cart/items/:itemId`
- `DELETE /api/cart`
- `POST /api/cart/merge` body: `{ "items": [{ "productId": "...", "quantity": 1, "size": "Large", "color": "Olive" }] }` — used by the frontend right after login to move the guest (localStorage) cart into the user's server cart.

Cart response item fields are deliberately flattened to your frontend style: `id`, `name`, `price`, `image`, `quantity`, `size`, `color`, plus `cartItemId` and `productId`.

### Wishlist (login required)
- `GET /api/wishlist`
- `POST /api/wishlist/:productId` toggles the product in/out of wishlist. Numeric legacy IDs are accepted.

### Orders (login required)
- `POST /api/orders/checkout` body:
```json
{
  "shippingAddress": {
    "fullName": "Customer Name",
    "phone": "03001234567",
    "address": "Street and house",
    "city": "Karachi",
    "postalCode": "75000",
    "country": "Pakistan"
  },
}
```
The checkout calculation matches the cart UI: 20% discount and $15 delivery. The delivery fee is decided by the server (a `deliveryFee` sent by the browser is ignored). Payment method is cash on delivery; no online payment gateway is connected.
- `GET /api/orders/my`
- Admin: `GET /api/orders`
- Admin: `PATCH /api/orders/:id/status` body `{ "status":"processing" }`

## Make your account admin
1. Register using `/api/auth/register`.
2. In MongoDB Atlas, open the `users` collection.
3. Change your user document's `role` from `customer` to `admin`.
4. Log in again to receive a fresh token.

Public registration cannot set an admin role.

## Connected to the React frontend
The `frontend` project now talks to this API:

| Frontend feature | API used |
| --- | --- |
| Home / category / search / product pages | `GET /api/products?limit=100` |
| Sign up / Log in / stay logged in | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Cart (logged in) | `GET/POST /api/cart`, `PATCH/DELETE /api/cart/items/:id` |
| Guest cart -> account after login | `POST /api/cart/merge` |
| Checkout (cash on delivery) | `POST /api/orders/checkout` |
| My Orders | `GET /api/orders/my` |

Deployment checklist:
1. Backend (Vercel): set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (your exact live frontend address) in the Vercel project's Environment Variables.
2. Frontend (Netlify/Vercel): set `VITE_API_URL` to the backend address (e.g. `https://shopco-backend-theta.vercel.app`) and redeploy.
3. Run `npm run seed` once on a fresh database. **It deletes all existing products first.**
