import { Router } from "express";
import {
  createPaymentMethod,
  listPaymentMethods,
  createPayment,
  markInvoicePaid,
  payEventFee,
  createManualInvoice,
  runDuesJob,
  sendInvoice,
  listMemberInvoices,
  downloadInvoicePdf,
  runPaymentReminders,
} from "./handlers";

const router = Router();

// Protected routes (auth middleware attached at app bootstrap)
router.post("/payment-methods", createPaymentMethod);
router.get("/payment-methods", listPaymentMethods);
router.post("/payments", createPayment);
router.post("/invoices/:id/mark-paid", markInvoicePaid);
router.post("/events/:id/pay", payEventFee);
router.post("/invoices", createManualInvoice);
router.get("/invoices", listMemberInvoices);
router.post("/internal/dues/run", runDuesJob);
router.post("/invoices/:id/send", sendInvoice);
router.get("/invoices/:id/pdf", downloadInvoicePdf);
router.post("/internal/payment-reminders/run", runPaymentReminders);

export default router;

