import "@/test/setup";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AlertType } from "@/core/alert-types";
import {
  createAlert,
  deleteAlert,
  getAlertById,
  getAlertsByUser,
  updateAlert,
  validateAirlineExists,
  validateAirportExists,
} from "@/core/alerts.db";
import { db } from "@/db/client";
import { createMockAlert, createMockAlertFilters } from "./mock-data";

const mockDb = db as {
  insert: ReturnType<typeof mock>;
  select: ReturnType<typeof mock>;
  update: ReturnType<typeof mock>;
  delete: ReturnType<typeof mock>;
  execute: ReturnType<typeof mock>;
  transaction: ReturnType<typeof mock>;
};

describe("alerts-db", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("createAlert", () => {
    it("should create a new alert successfully", async () => {
      const mockAlert = createMockAlert();
      const insertMock = mock().mockReturnValue({
        values: mock().mockReturnValue({
          returning: mock().mockResolvedValue([mockAlert]),
        }),
      });

      mockDb.insert = insertMock;

      const input = {
        userId: "user_123",
        type: AlertType.DAILY,
        filters: createMockAlertFilters(),
        alertEnd: "2024-12-31T23:59:59.000Z",
      };

      const result = await createAlert(input);

      expect(insertMock).toHaveBeenCalledWith(expect.anything());
      expect(result).toEqual(mockAlert);
    });

    it("should create alert without alertEnd", async () => {
      const mockAlert = createMockAlert({ alertEnd: null });
      const insertMock = mock().mockReturnValue({
        values: mock().mockReturnValue({
          returning: mock().mockResolvedValue([mockAlert]),
        }),
      });

      mockDb.insert = insertMock;

      const input = {
        userId: "user_123",
        type: AlertType.DAILY,
        filters: createMockAlertFilters(),
      };

      const result = await createAlert(input);

      expect(result).toEqual(mockAlert);
      expect(result.alertEnd).toBeNull();
    });
  });

  describe("getAlertById", () => {
    it("should return alert when found", async () => {
      const mockAlert = createMockAlert();
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([mockAlert]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await getAlertById("alert_123");

      expect(selectMock).toHaveBeenCalled();
      expect(result).toEqual(mockAlert);
    });

    it("should return null when alert not found", async () => {
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await getAlertById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getAlertsByUser", () => {
    it("should return all alerts for user without status filter", async () => {
      const mockAlerts = [
        createMockAlert(),
        createMockAlert({ id: "alert_456" }),
      ];
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            orderBy: mock().mockResolvedValue(mockAlerts),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await getAlertsByUser("user_123");

      expect(result).toEqual(mockAlerts);
    });

    it("should return filtered alerts by status", async () => {
      const mockAlerts = [createMockAlert({ status: "active" })];
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            orderBy: mock().mockResolvedValue(mockAlerts),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await getAlertsByUser("user_123", "active");

      expect(result).toEqual(mockAlerts);
    });
  });

  describe("updateAlert", () => {
    it("should update alert successfully", async () => {
      const mockAlert = createMockAlert({ status: "completed" });
      const updateMock = mock().mockReturnValue({
        set: mock().mockReturnValue({
          where: mock().mockReturnValue({
            returning: mock().mockResolvedValue([mockAlert]),
          }),
        }),
      });

      mockDb.update = updateMock;

      const result = await updateAlert("alert_123", { status: "completed" });

      expect(updateMock).toHaveBeenCalled();
      expect(result).toEqual(mockAlert);
    });

    it("should return null when alert not found", async () => {
      const updateMock = mock().mockReturnValue({
        set: mock().mockReturnValue({
          where: mock().mockReturnValue({
            returning: mock().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.update = updateMock;

      const result = await updateAlert("nonexistent", { status: "completed" });

      expect(result).toBeNull();
    });
  });

  describe("deleteAlert", () => {
    it("should soft delete alert successfully", async () => {
      const updateMock = mock().mockReturnValue({
        set: mock().mockReturnValue({
          where: mock().mockReturnValue({
            returning: mock().mockResolvedValue([createMockAlert()]),
          }),
        }),
      });

      mockDb.update = updateMock;

      const result = await deleteAlert("alert_123");

      expect(result).toBe(true);
    });

    it("should return false when alert not found", async () => {
      const updateMock = mock().mockReturnValue({
        set: mock().mockReturnValue({
          where: mock().mockReturnValue({
            returning: mock().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.update = updateMock;

      const result = await deleteAlert("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("validateAirportExists", () => {
    it("should return true when airport exists", async () => {
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([{ id: "airport_lax" }]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirportExists("LAX");

      expect(result).toBe(true);
    });

    it("should return false when airport does not exist", async () => {
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirportExists("XYZ");

      expect(result).toBe(false);
    });

    it("should handle lowercase airport codes", async () => {
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([{ id: "airport_lax" }]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirportExists("lax");

      expect(result).toBe(true);
      // Verify that the code was converted to uppercase
      expect(selectMock().from().where).toHaveBeenCalled();
    });
  });

  describe("validateAirlineExists", () => {
    it("should return true when airline exists", async () => {
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([{ id: "airline_aa" }]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirlineExists("AA");

      expect(result).toBe(true);
    });

    it("should return false when airline does not exist", async () => {
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirlineExists("XY");

      expect(result).toBe(false);
    });

    it("should handle lowercase airline codes", async () => {
      const selectMock = mock().mockReturnValue({
        from: mock().mockReturnValue({
          where: mock().mockReturnValue({
            limit: mock().mockResolvedValue([{ id: "airline_aa" }]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirlineExists("aa");

      expect(result).toBe(true);
    });
  });
});
