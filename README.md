# Compliance Checklist App

**The Cross-Platform Desktop Solution for Field Compliance Inspections.**

Maximize efficiency and ensure data integrity for your operational safety inspectors with a dedicated, offline-capable desktop application. Built with **Electron**, **Vue 3**, and a **Node.js** backend.

---

## 🚀 Features

- 🖥️ **Desktop First:** Cross-platform application (Windows, Linux, macOS) powered by Electron.
- ✅ **Guaranteed Data Integrity:** Real-time **JSON schema validation** using **Ajv** ensures all checklists meet regulatory standards before saving.
- 💾 **Robust State Management:** Modular, reactive state handling for checklists, evidence, and sessions via **Pinia**.
- 🪵 **Structured Auditing:** Integrated **Winston** logging for comprehensive and structured application and inspection activity logs.
- 🔔 **Non-Intrusive Feedback:** User notifications and confirmations delivered via **Vue-Toastification**.
- ⚙️ **Node.js Integration:** Seamless file system and native OS functionality access via the Node.js backend.

---

## 🧭 Project Structure

The project follows a modular approach for clear separation of concerns:

| Directory         | Purpose                                                                                                   |
| :---------------- | :-------------------------------------------------------------------------------------------------------- |
| `/src/components` | Reusable Vue components (e.g., `ChecklistTable`, `ChecklistRow`).                                         |
| `/src/stores`     | Pinia modules for application state management (e.g., `checklistStore`, `evidenceStore`, `sessionStore`). |
| `/src/utils`      | Utility modules for common logic (e.g., `fileOps.js` for file I/O, validation helpers).                   |
| `/logs`           | Directory where Winston saves structured application and inspection logs.                                 |
| `/tests`          | Unit and integration tests.                                                                               |

---

## 🛠️ Getting Started

### Prerequisites

- Node.js **18+**
- npm or yarn

### Installation & Development

```bash
# Clone the repository (using your actual Gitlab path)
git clone [https://gitlab.com/fksomdsd/compliance_app.git](https://gitlab.com/fksomdsd/compliance_app.git)
cd compliance_app

# Install dependencies
npm install

# Development Run
# Runs the Vue renderer and the Electron main process in dev mode.
npm run dev

# Build for Distribution (Generates executables for target platforms)
npm run build

# Run all unit and integration tests
npm test


Branching Model

This project uses a Gitflow-inspired workflow:

main → stable, production-ready code

develop → ongoing development

feature/ → for new features

fix/ → for bug fixes

release/ → for release preparation

hotfix/ → for urgent production patches

All merge requests should target the develop branch unless they are hotfixes.

### Data Contract Note

- Finding issue date uses `dateIssued` as the canonical field name.
- Alfresco model property `vso:openedDate` was renamed to `vso:dateIssued` for consistency across model, forms, and messaging.

🧩 Contributing

We welcome contributions! Please refer to the CONTRIBUTING.md file for detailed guidelines on setting up your environment, code style, and submitting a Merge Request.
