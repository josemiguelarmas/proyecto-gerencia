// Shared pieces of the admin panel: the TCB.adminTabs registry that every tab module in
// views/admin/ fills with { render(data), mount(root, ctx) } and that views/adminView.js
// composes, and the formatting helpers several tabs use. Load it before the tab modules.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminFormat = {
  cop: n => `$${Number(n || 0).toLocaleString('es-CO')}`
};
