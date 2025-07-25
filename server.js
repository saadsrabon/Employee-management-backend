// server.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = process.env.MONGODB_URI || "mongodb+srv://workfolow:pRBt5ofSOLFWV9m1@cluster0.ngwkmsl.mongodb.net/employee_management?retryWrites=true&w=majority&appName=Cluster0";
let db;
MongoClient.connect(uri)
  .then(client => {
    //create specif
    db = client.db(); // No need to specify name again, it's in the URI
    console.log('MongoDB connected!');
  })
  .catch(err => console.log('MongoDB connection error:', err));

// --- Step 2: User Registration & Login (Native MongoDB) ---
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper: Password validation
function validatePassword(password) {
  const errors = [];
  if (password.length < 6) errors.push('Password must be at least 6 characters.');
  if (!/[A-Z]/.test(password)) errors.push('Password must have a capital letter.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must have a special character.');
  return errors;
}

// Helper: JWT sign
function signToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role, id: user._id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );
}

// Registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, bank_account_no, salary, designation, photo } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    if (role === 'Admin') {
      return res.status(403).json({ message: 'Cannot register as Admin.' });
    }
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ message: passwordErrors.join(' ') });
    }
    const usersCol = db.collection('users');
    const existing = await usersCol.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const userDoc = {
      email,
      password: hashed,
      name,
      role,
      bank_account_no,
      salary: salary || 0,
      designation,
      photo,
      isVerified: false,
      isFired: false,
      createdAt: new Date(),
    };
    const result = await usersCol.insertOne(userDoc);
    const user = { ...userDoc, _id: result.insertedId };
    const token = signToken(user);
    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email does not match.' });
    }
    if (user.isFired) {
      return res.status(403).json({ message: 'You have been fired. Contact admin.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Password does not match.' });
    }
    const token = signToken(user);
    res.json({
      message: 'Login successful!',
      token,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
});

// --- Step 3: JWT Middleware & Worksheet CRUD ---

// JWT Auth Middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header.' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(401).json({ message: 'Invalid token.' });
    req.user = user;
    next();
  });
}

// Role Middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role.' });
    }
    next();
  };
}

// --- Worksheet CRUD ---
// Collection: work_sheets

// Add worksheet (Employee only)
app.post('/work-sheets', authenticateJWT, requireRole('Employee'), async (req, res) => {
  try {
    const { task, hoursWorked, date } = req.body;
    if (!task || !hoursWorked || !date) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    const workSheet = {
      userId: req.user.id,
      email: req.user.email,
      task,
      hoursWorked: Number(hoursWorked),
      date: new Date(date),
      createdAt: new Date(),
    };
    const result = await db.collection('work_sheets').insertOne(workSheet);
    res.status(201).json({ message: 'Work added!', workSheet: { ...workSheet, _id: result.insertedId } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add work.', error: err.message });
  }
});

// Get worksheets (Employee: own, HR: all, filterable)
app.get('/work-sheets', authenticateJWT, requireRole('Employee', 'HR'), async (req, res) => {
  try {
    const { month, year, userId } = req.query;
    let filter = {};
    if (req.user.role === 'Employee') {
      filter.userId = req.user.id;
    } else if (req.user.role === 'HR' && userId) {
      filter.userId = userId;
    }
    if (month && year) {
      // Filter by month/year
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      filter.date = { $gte: start, $lt: end };
    }
    const workSheets = await db.collection('work_sheets').find(filter).sort({ date: -1 }).toArray();
    res.json({ workSheets });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch work sheets.', error: err.message });
  }
});

// Edit worksheet (Employee only, own worksheet)
app.patch('/work-sheets/:id', authenticateJWT, requireRole('Employee'), async (req, res) => {
  try {
    const { id } = req.params;
    const { task, hoursWorked, date } = req.body;
    const workSheet = await db.collection('work_sheets').findOne({ _id: new ObjectId(id) });
    if (!workSheet) return res.status(404).json({ message: 'Work sheet not found.' });
    if (workSheet.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden: not your worksheet.' });
    const update = {};
    if (task) update.task = task;
    if (hoursWorked) update.hoursWorked = Number(hoursWorked);
    if (date) update.date = new Date(date);
    await db.collection('work_sheets').updateOne({ _id: new ObjectId(id) }, { $set: update });
    res.json({ message: 'Work sheet updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update work sheet.', error: err.message });
  }
});

// Delete worksheet (Employee only, own worksheet)
app.delete('/work-sheets/:id', authenticateJWT, requireRole('Employee'), async (req, res) => {
  try {
    const { id } = req.params;
    const workSheet = await db.collection('work_sheets').findOne({ _id: new ObjectId(id) });
    if (!workSheet) return res.status(404).json({ message: 'Work sheet not found.' });
    if (workSheet.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden: not your worksheet.' });
    await db.collection('work_sheets').deleteOne({ _id: new ObjectId(id) });
    res.json({ message: 'Work sheet deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete work sheet.', error: err.message });
  }
});

// --- Step 4: Payment History, HR Payroll, and Admin Payroll ---

// A. Employee: View own payment history (paginated)
app.get('/payments', authenticateJWT, requireRole('Employee'), async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paymentsCol = db.collection('payments');
    const payments = await paymentsCol
      .find({ userId: req.user.id })
      .sort({ year: 1, month: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    const total = await paymentsCol.countDocuments({ userId: req.user.id });
    res.json({ payments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payments.', error: err.message });
  }
});

// B. HR: Employee list
app.get('/employee-list', authenticateJWT, requireRole('HR'), async (req, res) => {
  try {
    const users = await db.collection('users').find({ role: 'Employee' }).toArray();
    res.json({ employees: users });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch employees.', error: err.message });
  }
});

// HR: Verify/unverify employee
app.patch('/users/:id/verify', authenticateJWT, requireRole('HR', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!user || user.role !== 'Employee') return res.status(404).json({ message: 'Employee not found.' });
    const newStatus = !user.isVerified;
    await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { isVerified: newStatus } });
    res.json({ message: `Employee verification set to ${newStatus}` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update verification.', error: err.message });
  }
});

// HR: Request payment for employee (only if verified, only once per month/year)
app.post('/payroll', authenticateJWT, requireRole('HR'), async (req, res) => {
  try {
    const { employeeId, month, year, amount } = req.body;
    if (!employeeId || !month || !year || !amount) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    const user = await db.collection('users').findOne({ _id: new ObjectId(employeeId) });
    if (!user || user.role !== 'Employee') return res.status(404).json({ message: 'Employee not found.' });
    if (!user.isVerified) return res.status(400).json({ message: 'Employee not verified.' });
    // Prevent double payroll request for same month/year
    const exists = await db.collection('payroll').findOne({ employeeId, month, year });
    if (exists) return res.status(409).json({ message: 'Payroll request already exists for this month/year.' });
    const payrollDoc = {
      employeeId,
      employeeName: user.name,
      salary: amount,
      month,
      year,
      requestedBy: req.user.id,
      requestedAt: new Date(),
      paymentDate: null,
      paid: false,
      transactionId: null,
    };
    await db.collection('payroll').insertOne(payrollDoc);
    res.status(201).json({ message: 'Payroll request created.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create payroll request.', error: err.message });
  }
});

// C. Admin: View all payroll requests
app.get('/payroll', authenticateJWT, requireRole('Admin'), async (req, res) => {
  try {
    const payrolls = await db.collection('payroll').find({}).sort({ year: -1, month: -1 }).toArray();
    res.json({ payrolls });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payrolls.', error: err.message });
  }
});

// Admin: Approve/pay payroll (prevent double pay)
app.patch('/payroll/:id/pay', authenticateJWT, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await db.collection('payroll').findOne({ _id: new ObjectId(id) });
    if (!payroll) return res.status(404).json({ message: 'Payroll request not found.' });
    if (payroll.paid) return res.status(400).json({ message: 'Already paid.' });
    // Prevent double payment for same employee/month/year
    const alreadyPaid = await db.collection('payments').findOne({ userId: payroll.employeeId, month: payroll.month, year: payroll.year });
    if (alreadyPaid) return res.status(409).json({ message: 'Payment already made for this month/year.' });
    // Mark payroll as paid
    const paymentDate = new Date();
    const transactionId = 'TXN' + Date.now();
    await db.collection('payroll').updateOne({ _id: new ObjectId(id) }, { $set: { paid: true, paymentDate, transactionId } });
    // Add to payments collection
    await db.collection('payments').insertOne({
      userId: payroll.employeeId,
      name: payroll.employeeName,
      amount: payroll.salary,
      month: payroll.month,
      year: payroll.year,
      transactionId,
      paymentDate,
    });
    res.json({ message: 'Payment successful.', transactionId });
  } catch (err) {
    res.status(500).json({ message: 'Failed to process payment.', error: err.message });
  }
});

// --- Step 5: Admin - Fire/Make HR/Salary Adjustment ---

// Admin: Get all verified employees and HRs
app.get('/all-employee-list', authenticateJWT, requireRole('Admin'), async (req, res) => {
  try {
    const users = await db.collection('users').find({ isVerified: true, isFired: { $ne: true } }).toArray();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.', error: err.message });
  }
});

// Admin: Fire user (prevent login)
app.patch('/users/:id/fire', authenticateJWT, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isFired) return res.status(400).json({ message: 'User already fired.' });
    await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { isFired: true } });
    res.json({ message: 'User fired.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fire user.', error: err.message });
  }
});

// Admin: Promote employee to HR
app.patch('/users/:id/make-hr', authenticateJWT, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'HR') return res.status(400).json({ message: 'User is already HR.' });
    await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { role: 'HR' } });
    res.json({ message: 'User promoted to HR.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to promote user.', error: err.message });
  }
});

// Admin: Adjust salary (only allow increase)
app.patch('/users/:id/salary', authenticateJWT, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newSalary } = req.body;
    if (!newSalary || isNaN(newSalary)) return res.status(400).json({ message: 'Invalid salary.' });
    const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (Number(newSalary) <= Number(user.salary)) return res.status(400).json({ message: 'Salary can only be increased.' });
    await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { salary: Number(newSalary) } });
    res.json({ message: 'Salary updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update salary.', error: err.message });
  }
});

// --- Step 6: Contact Us Endpoints ---

// Anyone: Send a contact message
app.post('/contact', async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) return res.status(400).json({ message: 'Email and message required.' });
    await db.collection('messages').insertOne({ email, message, createdAt: new Date() });
    res.status(201).json({ message: 'Message sent!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send message.', error: err.message });
  }
});

// Admin: View all contact messages
app.get('/contact', authenticateJWT, requireRole('Admin'), async (req, res) => {
  try {
    const messages = await db.collection('messages').find({}).sort({ createdAt: -1 }).toArray();
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch messages.', error: err.message });
  }
});

// --- Step 7: HR Employee Details Endpoint ---

// HR: View employee details and salary/month chart data
app.get('/employee-details/:id', authenticateJWT, requireRole('HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.collection('users').findOne({ _id: new ObjectId(id), role: 'Employee' });
    if (!user) return res.status(404).json({ message: 'Employee not found.' });
    // Get payment history for chart
    const payments = await db.collection('payments').find({ userId: id }).sort({ year: 1, month: 1 }).toArray();
    res.json({
      name: user.name,
      photo: user.photo,
      designation: user.designation,
      payments, // [{month, year, amount, ...}]
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch employee details.', error: err.message });
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('Employee Management Backend is running!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
