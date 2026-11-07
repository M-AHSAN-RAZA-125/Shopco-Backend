const Cart = require("../models/Cart");
const Product = require("../models/Product");

const populate = cart => cart.populate("items.product");
const serialize = cart => ({
  id: cart._id,
  items: cart.items.filter(i => i.product).map(i => ({
    cartItemId: i._id,
    productId: i.product._id,
    id: i.product.legacyId,
    name: i.product.name,
    price: i.product.price,
    image: i.product.image,
    quantity: i.quantity,
    size: i.size,
    color: i.color,
    stock: i.product.stock
  }))
});
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });
    cart = await populate(cart);
    res.json({ success: true, cart: serialize(cart) });
  } catch (error) { next(error); }
};
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, id, quantity = 1, size = "Standard", color = "Default" } = req.body;
    const requestedId = productId ?? id;
    const qty = Number(quantity);
    if (requestedId === undefined || !Number.isInteger(qty) || qty < 1) return res.status(400).json({ success: false, message: "productId and a positive integer quantity are required" });
    const product = await Product.findOne(/^\d+$/.test(String(requestedId)) ? { legacyId: Number(requestedId) } : { _id: requestedId });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });
    const existing = cart.items.find(item => item.product.toString() === product._id.toString() && item.size === size && item.color === color);
    const newQty = (existing?.quantity || 0) + qty;
    if (product.stock < newQty) return res.status(400).json({ success: false, message: "Not enough stock available" });
    if (existing) existing.quantity = newQty;
    else cart.items.push({ product: product._id, quantity: qty, size, color });
    await cart.save();
    await populate(cart);
    res.json({ success: true, cart: serialize(cart) });
  } catch (error) { next(error); }
};
exports.updateCartItem = async (req, res, next) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    const cart = await Cart.findOne({ user: req.user._id });
    const item = cart?.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: "Cart item not found" });
    const product = await Product.findById(item.product);
    if (!product || product.stock < quantity) return res.status(400).json({ success: false, message: "Requested quantity unavailable" });
    item.quantity = quantity;
    await cart.save();
    await populate(cart);
    res.json({ success: true, cart: serialize(cart) });
  } catch (error) { next(error); }
};
exports.removeCartItem = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    const item = cart?.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: "Cart item not found" });
    item.deleteOne(); await cart.save(); await populate(cart);
    res.json({ success: true, cart: serialize(cart) });
  } catch (error) { next(error); }
};
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] }, { new: true });
    res.json({ success: true, cart: cart ? serialize(await populate(cart)) : { items: [] } });
  } catch (error) { next(error); }
};

// Merge a guest (localStorage) cart into the logged-in user's cart.
// body: { items: [{ productId | id, quantity, size, color }] }
exports.mergeCart = async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body.items) ? req.body.items : [];
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    for (const raw of incoming) {
      const requestedId = raw.productId ?? raw.id;
      const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
      if (requestedId === undefined || requestedId === null || requestedId === "") continue;
      const size = raw.size || "Standard";
      const color = raw.color || "Default";
      const query = /^\d+$/.test(String(requestedId)) ? { legacyId: Number(requestedId) } : { _id: requestedId };
      let product = null;
      try { product = await Product.findOne(query); } catch (_e) { /* invalid id from an old guest cart: skip it */ }
      if (!product || product.stock < 1) continue;

      const existing = cart.items.find(i => i.product.toString() === product._id.toString() && i.size === size && i.color === color);
      const wanted = Math.min((existing?.quantity || 0) + qty, product.stock);
      if (existing) existing.quantity = wanted;
      else cart.items.push({ product: product._id, quantity: wanted, size, color });
    }
    await cart.save();
    await populate(cart);
    res.json({ success: true, cart: serialize(cart) });
  } catch (error) { next(error); }
};
