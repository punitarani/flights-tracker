import { beforeEach, describe, expect, it, vi } from "vitest";
import * as alertsDb from "@/core/alerts-db";
import {
  createFlightAlert,
  getFlightAlert,
  getUserAlerts,
  validateAlertFilters,
} from "@/core/alerts-service";
import { AlertNotFoundError, AlertValidationError } from "@/core/errors";
import type { AlertFilters } from "@/core/filters";
import {
  createMockAlert,
  createMockAlertFilters,
  createMockAlertId,
  createMockUserId,
} from "./mock-data";

// Mock the alerts-db module
vi.mock("@/core/alerts-db");
const mockedAlertsDb = vi.mocked(alertsDb);

describe("alerts-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateAlertFilters", () => {
    it("should pass validation for valid filters", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      const filters = createMockAlertFilters();

      await expect(validateAlertFilters(filters)).resolves.not.toThrow();
    });

    it("should throw error for invalid filter schema", async () => {
      const invalidFilters = {
        version: 1,
        from: "INVALID",
      } as unknown as AlertFilters;

      await expect(validateAlertFilters(invalidFilters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when origin airport does not exist", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValueOnce(false); // from airport

      const filters = createMockAlertFilters({ from: "XXX" });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when destination airport does not exist", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValueOnce(true); // from airport
      mockedAlertsDb.validateAirportExists.mockResolvedValueOnce(false); // to airport

      const filters = createMockAlertFilters({ to: "YYY" });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when airline does not exist", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(false);

      const filters = createMockAlertFilters({ airlines: ["XX"] });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when origin and destination are the same", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);

      const filters = createMockAlertFilters({ from: "LAX", to: "LAX" });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error for negative price", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      const filters = createMockAlertFilters({ price: -100 });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });
  });

  describe("createFlightAlert", () => {
    it("should create alert successfully with valid data", async () => {
      const mockAlert = createMockAlert();
      const userId = createMockUserId();
      const filters = createMockAlertFilters();

      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);
      mockedAlertsDb.createAlert.mockResolvedValue(mockAlert);

      const result = await createFlightAlert(userId, filters);

      expect(mockedAlertsDb.createAlert).toHaveBeenCalledWith({
        userId,
        filters,
        alertEnd: undefined,
      });
      expect(result).toEqual(mockAlert);
    });

    it("should create alert with valid end date", async () => {
      const mockAlert = createMockAlert();
      const userId = createMockUserId();
      const filters = createMockAlertFilters();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const alertEnd = futureDate.toISOString();

      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);
      mockedAlertsDb.createAlert.mockResolvedValue(mockAlert);

      const result = await createFlightAlert(userId, filters, alertEnd);

      expect(mockedAlertsDb.createAlert).toHaveBeenCalledWith({
        userId,
        filters,
        alertEnd,
      });
      expect(result).toEqual(mockAlert);
    });

    it("should throw error for empty user ID", async () => {
      const filters = createMockAlertFilters();

      await expect(createFlightAlert("", filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error for invalid end date format", async () => {
      const userId = createMockUserId();
      const filters = createMockAlertFilters();

      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      await expect(
        createFlightAlert(userId, filters, "invalid-date"),
      ).rejects.toThrow(AlertValidationError);
    });

    it("should throw error for past end date", async () => {
      const userId = createMockUserId();
      const filters = createMockAlertFilters();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const alertEnd = pastDate.toISOString();

      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      await expect(
        createFlightAlert(userId, filters, alertEnd),
      ).rejects.toThrow(AlertValidationError);
    });
  });

  describe("getFlightAlert", () => {
    it("should return alert for valid user and alert ID", async () => {
      const mockAlert = createMockAlert();
      const userId = mockAlert.userId;
      const alertId = mockAlert.id;

      mockedAlertsDb.getAlertById.mockResolvedValue(mockAlert);

      const result = await getFlightAlert(alertId, userId);

      expect(mockedAlertsDb.getAlertById).toHaveBeenCalledWith(alertId);
      expect(result).toEqual(mockAlert);
    });

    it("should throw AlertNotFoundError when alert does not exist", async () => {
      const userId = createMockUserId();
      const alertId = createMockAlertId();

      mockedAlertsDb.getAlertById.mockResolvedValue(null);

      await expect(getFlightAlert(alertId, userId)).rejects.toThrow(
        AlertNotFoundError,
      );
    });

    it("should throw AlertNotFoundError when user does not own alert", async () => {
      const mockAlert = createMockAlert({ userId: "other_user" });
      const userId = createMockUserId();
      const alertId = mockAlert.id;

      mockedAlertsDb.getAlertById.mockResolvedValue(mockAlert);

      await expect(getFlightAlert(alertId, userId)).rejects.toThrow(
        AlertNotFoundError,
      );
    });

    it("should throw error for empty parameters", async () => {
      await expect(getFlightAlert("", "user123")).rejects.toThrow(
        AlertValidationError,
      );
      await expect(getFlightAlert("alert123", "")).rejects.toThrow(
        AlertValidationError,
      );
    });
  });

  describe("getUserAlerts", () => {
    it("should return all user alerts without status filter", async () => {
      const mockAlerts = [createMockAlert(), createMockAlert({ id: "alert2" })];
      const userId = createMockUserId();

      mockedAlertsDb.getAlertsByUser.mockResolvedValue(mockAlerts);

      const result = await getUserAlerts(userId);

      expect(mockedAlertsDb.getAlertsByUser).toHaveBeenCalledWith(
        userId,
        undefined,
      );
      expect(result).toEqual(mockAlerts);
    });

    it("should return filtered alerts by status", async () => {
      const mockAlerts = [createMockAlert({ status: "active" })];
      const userId = createMockUserId();

      mockedAlertsDb.getAlertsByUser.mockResolvedValue(mockAlerts);

      const result = await getUserAlerts(userId, "active");

      expect(mockedAlertsDb.getAlertsByUser).toHaveBeenCalledWith(
        userId,
        "active",
      );
      expect(result).toEqual(mockAlerts);
    });

    it("should throw error for empty user ID", async () => {
      await expect(getUserAlerts("")).rejects.toThrow(AlertValidationError);
    });
  });
});
