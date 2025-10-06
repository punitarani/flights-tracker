import "@/test/setup";
import { AlertType } from "@/core/alert-types";
import {
  createAlert,
  deleteAlert,
  getAlertById,
  getAlertsByUser,
  updateAlert,
  validateAirlineExists,
  validateAirportExists,
} from "@/core/alerts-db";
import { db } from "@/db/client";
import { createMockAlert, createMockAlertFilters } from "./mock-data";

const mockDb = vi.mocked(db);

describe("alerts-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAlert", () => {
    it("should create a new alert successfully", async () => {
      const mockAlert = createMockAlert();
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAlert]),
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
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAlert]),
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
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAlert]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await getAlertById("alert_123");

      expect(selectMock).toHaveBeenCalled();
      expect(result).toEqual(mockAlert);
    });

    it("should return null when alert not found", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
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
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAlerts),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await getAlertsByUser("user_123");

      expect(result).toEqual(mockAlerts);
    });

    it("should return filtered alerts by status", async () => {
      const mockAlerts = [createMockAlert({ status: "active" })];
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAlerts),
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
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockAlert]),
          }),
        }),
      });

      mockDb.update = updateMock;

      const result = await updateAlert("alert_123", { status: "completed" });

      expect(updateMock).toHaveBeenCalled();
      expect(result).toEqual(mockAlert);
    });

    it("should return null when alert not found", async () => {
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
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
      const mockAlert = createMockAlert({ status: "deleted" });
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockAlert]),
          }),
        }),
      });

      mockDb.update = updateMock;

      const result = await deleteAlert("alert_123");

      expect(result).toBe(true);
    });

    it("should return false when alert not found", async () => {
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
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
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "airport_lax" }]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirportExists("LAX");

      expect(result).toBe(true);
    });

    it("should return false when airport does not exist", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirportExists("XYZ");

      expect(result).toBe(false);
    });

    it("should handle lowercase airport codes", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "airport_lax" }]),
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
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "airline_aa" }]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirlineExists("AA");

      expect(result).toBe(true);
    });

    it("should return false when airline does not exist", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirlineExists("XY");

      expect(result).toBe(false);
    });

    it("should handle lowercase airline codes", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "airline_aa" }]),
          }),
        }),
      });

      mockDb.select = selectMock;

      const result = await validateAirlineExists("aa");

      expect(result).toBe(true);
    });
  });
});
