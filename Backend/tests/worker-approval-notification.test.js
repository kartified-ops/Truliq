const assert = require('assert');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Worker = require('../models/Worker');
const { approveWorker, rejectWorker, suspendWorker } = require('../controllers/adminControllers/adminWorkerController');

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
  } catch (err) {
    results.push([false, `${name}\n    ${err.message}`]);
  }
};

const main = async () => {
  // Mock Notification.findOne and Notification.create to avoid Mongoose buffering when DB is not connected
  const originalFindOne = Notification.findOne;
  const originalCreate = Notification.create;
  const capturedNotifications = [];

  Notification.findOne = async () => null;
  Notification.create = async (doc) => {
    capturedNotifications.push(doc);
    return { _id: new mongoose.Types.ObjectId(), ...doc };
  };

  try {
    await check('Notification model schema enum includes worker_approved, worker_rejected, worker_suspended', async () => {
      const typeEnum = Notification.schema.path('type').enumValues;
      assert.ok(typeEnum.includes('worker_approved'), 'Should include worker_approved');
      assert.ok(typeEnum.includes('worker_rejected'), 'Should include worker_rejected');
      assert.ok(typeEnum.includes('worker_suspended'), 'Should include worker_suspended');
    });

    await check('Worker model schema has approvalDate and rejectedReason fields', async () => {
      assert.ok(Worker.schema.path('approvalDate'), 'Worker schema should include approvalDate');
      assert.ok(Worker.schema.path('rejectedReason'), 'Worker schema should include rejectedReason');
      assert.ok(Worker.schema.path('approvalStatus'), 'Worker schema should include approvalStatus');
    });

    await check('approveWorker controller sets status to approved, isActive true, and creates worker_approved notification', async () => {
      capturedNotifications.length = 0;
      const mockWorkerId = new mongoose.Types.ObjectId();
      const fakeWorker = {
        _id: mockWorkerId,
        name: 'Test Worker',
        phone: '+919876543210',
        approvalStatus: 'pending',
        isActive: false,
        save: async function () { return this; }
      };

      const originalFindById = Worker.findById;
      Worker.findById = async (id) => {
        if (String(id) === String(mockWorkerId)) return fakeWorker;
        return null;
      };

      const req = { params: { id: mockWorkerId.toString() } };
      let jsonResult = null;
      let statusCode = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonResult = data;
              return data;
            }
          };
        }
      };

      try {
        await approveWorker(req, res);
        assert.strictEqual(statusCode, 200);
        assert.strictEqual(fakeWorker.approvalStatus, 'approved');
        assert.strictEqual(fakeWorker.isActive, true);
        assert.ok(fakeWorker.approvalDate instanceof Date);
        assert.strictEqual(jsonResult.success, true);

        // Verify notification
        assert.strictEqual(capturedNotifications.length, 1);
        assert.strictEqual(capturedNotifications[0].workerId.toString(), mockWorkerId.toString());
        assert.strictEqual(capturedNotifications[0].type, 'worker_approved');
      } finally {
        Worker.findById = originalFindById;
      }
    });

    await check('rejectWorker controller sets status to rejected, isActive false, and creates worker_rejected notification', async () => {
      capturedNotifications.length = 0;
      const mockWorkerId = new mongoose.Types.ObjectId();
      const fakeWorker = {
        _id: mockWorkerId,
        name: 'Test Worker',
        phone: '+919876543210',
        approvalStatus: 'pending',
        isActive: true,
        save: async function () { return this; }
      };

      const originalFindById = Worker.findById;
      Worker.findById = async (id) => {
        if (String(id) === String(mockWorkerId)) return fakeWorker;
        return null;
      };

      const req = {
        params: { id: mockWorkerId.toString() },
        body: { reason: 'Incomplete document' }
      };
      let jsonResult = null;
      let statusCode = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonResult = data;
              return data;
            }
          };
        }
      };

      try {
        await rejectWorker(req, res);
        assert.strictEqual(statusCode, 200);
        assert.strictEqual(fakeWorker.approvalStatus, 'rejected');
        assert.strictEqual(fakeWorker.isActive, false);
        assert.strictEqual(fakeWorker.rejectedReason, 'Incomplete document');
        assert.strictEqual(jsonResult.success, true);

        // Verify notification
        assert.strictEqual(capturedNotifications.length, 1);
        assert.strictEqual(capturedNotifications[0].workerId.toString(), mockWorkerId.toString());
        assert.strictEqual(capturedNotifications[0].type, 'worker_rejected');
      } finally {
        Worker.findById = originalFindById;
      }
    });

    await check('suspendWorker controller sets status to suspended and creates worker_suspended notification', async () => {
      capturedNotifications.length = 0;
      const mockWorkerId = new mongoose.Types.ObjectId();
      const fakeWorker = {
        _id: mockWorkerId,
        name: 'Test Worker',
        phone: '+919876543210',
        approvalStatus: 'approved',
        isActive: true,
        save: async function () { return this; }
      };

      const originalFindById = Worker.findById;
      Worker.findById = async (id) => {
        if (String(id) === String(mockWorkerId)) return fakeWorker;
        return null;
      };

      const req = { params: { id: mockWorkerId.toString() } };
      let jsonResult = null;
      let statusCode = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonResult = data;
              return data;
            }
          };
        }
      };

      try {
        await suspendWorker(req, res);
        assert.strictEqual(statusCode, 200);
        assert.strictEqual(fakeWorker.approvalStatus, 'suspended');
        assert.strictEqual(fakeWorker.isActive, false);
        assert.strictEqual(jsonResult.success, true);

        // Verify notification
        assert.strictEqual(capturedNotifications.length, 1);
        assert.strictEqual(capturedNotifications[0].workerId.toString(), mockWorkerId.toString());
        assert.strictEqual(capturedNotifications[0].type, 'worker_suspended');
      } finally {
        Worker.findById = originalFindById;
      }
    });

    await check('deleteProfile controller sends push notification before deleting worker document', async () => {
      const { deleteProfile } = require('../controllers/workerControllers/workerProfileController');
      const firebaseAdmin = require('../services/firebaseAdmin');
      const mockWorkerId = new mongoose.Types.ObjectId();
      const fakeWorker = {
        _id: mockWorkerId,
        name: 'Test Worker',
        fcmTokens: ['token_123'],
        fcmTokenMobile: ['mobile_token_456']
      };

      let pushRecipient = null;
      let pushPayload = null;
      let workerDeletedId = null;

      const originalSendPush = firebaseAdmin.sendPushNotification;
      const originalFindById = Worker.findById;
      const originalFindByIdAndDelete = Worker.findByIdAndDelete;

      firebaseAdmin.sendPushNotification = async (recipient, payload) => {
        pushRecipient = recipient;
        pushPayload = payload;
        return { successCount: 1, failureCount: 0 };
      };

      Worker.findById = async (id) => {
        if (String(id) === String(mockWorkerId)) return fakeWorker;
        return null;
      };

      Worker.findByIdAndDelete = async (id) => {
        workerDeletedId = id;
        return fakeWorker;
      };

      const req = { user: { id: mockWorkerId.toString() } };
      let jsonResult = null;
      let statusCode = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonResult = data;
              return data;
            }
          };
        }
      };

      try {
        await deleteProfile(req, res);
        assert.strictEqual(statusCode, 200);
        assert.strictEqual(jsonResult.success, true);
        assert.ok(pushPayload, 'Push payload should be sent');
        assert.strictEqual(pushPayload.data?.type, 'worker_deleted');
        assert.strictEqual(pushRecipient._id.toString(), mockWorkerId.toString());
        assert.strictEqual(workerDeletedId.toString(), mockWorkerId.toString());
      } finally {
        firebaseAdmin.sendPushNotification = originalSendPush;
        Worker.findById = originalFindById;
        Worker.findByIdAndDelete = originalFindByIdAndDelete;
      }
    });

    await check('admin deleteWorker controller sends push notification before deleting worker document', async () => {
      const { deleteWorker } = require('../controllers/adminControllers/adminWorkerController');
      const firebaseAdmin = require('../services/firebaseAdmin');
      const mockWorkerId = new mongoose.Types.ObjectId();
      const fakeWorker = {
        _id: mockWorkerId,
        name: 'Test Worker',
        fcmTokens: ['token_123'],
        fcmTokenMobile: ['mobile_token_456']
      };

      let pushRecipient = null;
      let pushPayload = null;
      let workerDeletedId = null;

      const originalSendPush = firebaseAdmin.sendPushNotification;
      const originalFindById = Worker.findById;
      const originalFindByIdAndDelete = Worker.findByIdAndDelete;

      firebaseAdmin.sendPushNotification = async (recipient, payload) => {
        pushRecipient = recipient;
        pushPayload = payload;
        return { successCount: 1, failureCount: 0 };
      };

      Worker.findById = async (id) => {
        if (String(id) === String(mockWorkerId)) return fakeWorker;
        return null;
      };

      Worker.findByIdAndDelete = async (id) => {
        workerDeletedId = id;
        return fakeWorker;
      };

      const req = { params: { id: mockWorkerId.toString() } };
      let jsonResult = null;
      let statusCode = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonResult = data;
              return data;
            }
          };
        }
      };

      try {
        await deleteWorker(req, res);
        assert.strictEqual(statusCode, 200);
        assert.strictEqual(jsonResult.success, true);
        assert.ok(pushPayload, 'Push payload should be sent');
        assert.strictEqual(pushPayload.data?.type, 'worker_deleted');
        assert.strictEqual(pushRecipient._id.toString(), mockWorkerId.toString());
        assert.strictEqual(workerDeletedId.toString(), mockWorkerId.toString());
      } finally {
        firebaseAdmin.sendPushNotification = originalSendPush;
        Worker.findById = originalFindById;
        Worker.findByIdAndDelete = originalFindByIdAndDelete;
      }
    });
  } finally {
    Notification.findOne = originalFindOne;
    Notification.create = originalCreate;
  }

  const passed = results.filter(([ok]) => ok).length;
  const failed = results.length - passed;

  results.forEach(([ok, name]) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  });

  console.log(`\n${passed}/${results.length} tests passed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
};

main();
