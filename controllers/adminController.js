const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");

// GET /api/users - List all registered users (Admin only)
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({
      success: true,
      count: users.length,
      users: users.map((u) => ({
        id: u._id,
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        joinedDate: u.createdAt ? u.createdAt.toISOString().split("T")[0] : "",
        status: "Active",
      })),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id - Update user details or role (Admin only)
exports.updateUser = async (req, res, next) => {
  try {
    const { name, role } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (role && ["customer", "admin"].includes(role)) updates.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        status: "Active",
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/:id - Delete a user (Admin only)
exports.deleteUser = async (req, res, next) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own admin account",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/stats - Live overview stats & chart metrics
exports.getAdminStats = async (req, res, next) => {
  try {
    const [totalProducts, totalOrders, totalUsers, products, orders] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments(),
      Product.find().select("name stock category price"),
      Order.find().select("total subtotal items status createdAt"),
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 10).length;
    const outOfStockCount = products.filter((p) => p.stock === 0).length;

    // Monthly orders & revenue aggregation
    const monthlyMap = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Seed current year months
    months.forEach((m) => {
      monthlyMap[m] = { month: m, revenue: 0, orders: 0 };
    });

    orders.forEach((o) => {
      if (o.createdAt) {
        const d = new Date(o.createdAt);
        const m = months[d.getMonth()];
        if (monthlyMap[m]) {
          monthlyMap[m].revenue += o.total || 0;
          monthlyMap[m].orders += 1;
        }
      }
    });

    // Category breakdown
    const categoryMap = {};
    products.forEach((p) => {
      const cat = p.category || "Uncategorized";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({
      name,
      value,
    }));

    // Status breakdown
    const statusMap = { placed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    orders.forEach((o) => {
      if (statusMap[o.status] !== undefined) statusMap[o.status]++;
    });

    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalUsers,
        lowStockCount,
        outOfStockCount,
        monthlyData: Object.values(monthlyMap),
        categoryBreakdown,
        statusBreakdown: statusMap,
      },
    });
  } catch (error) {
    next(error);
  }
};
