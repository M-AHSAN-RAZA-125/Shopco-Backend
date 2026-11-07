const router = require("express").Router();
const { protect, adminOnly } = require("../middleware/auth");
const { getUsers, updateUser, deleteUser, getAdminStats } = require("../controllers/adminController");

router.use(protect, adminOnly);

// Users management
router.get("/users", getUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Dashboard metrics & stats
router.get("/stats", getAdminStats);

module.exports = router;
