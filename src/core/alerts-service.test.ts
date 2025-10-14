import "@/test/setup";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AlertType } from "@/core/alert-types";
import * as alertsDb from "@/core/alerts.db";
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

mock.module("@/core/alerts.db", () => ({
  validateAirportExists: mock(),
  validateAirlineExists: mock(),
  createAlert: mock(),
  getAlertById: mock(),
  getAlertsByUser: mock(),
}));
const mockedAlertsDb = alertsDb as {
  validateAirportExists: ReturnType<typeof mock>;
  validateAirlineExists: ReturnType<typeof mock>;
  createAlert: ReturnType<typeof mock>;
  getAlertById: ReturnType<typeof mock>;
  getAlertsByUser: ReturnType<typeof mock>;
};

describe("alerts-service", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("validateAlertFilters", () => {
    it("should pass validation for valid filters", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      const filters = createMockAlertFilters();

      await expect(validateAlertFilters(filters)).resolves.toBeUndefined();
    });

    it("should throw error for invalid filter schema", async () => {
      const invalidFilters = {
        version: 1,
        route: {
          from: "INVALID",
          to: "JFK",
        },
        filters: {},
      } as unknown as AlertFilters;

      await expect(validateAlertFilters(invalidFilters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when origin airport does not exist", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValueOnce(false); // from airport

      const filters = createMockAlertFilters({
        route: { from: "XXX", to: "JFK" },
      });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when destination airport does not exist", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValueOnce(true); // from airport
      mockedAlertsDb.validateAirportExists.mockResolvedValueOnce(false); // to airport

      const filters = createMockAlertFilters({
        route: { from: "LAX", to: "YYY" },
      });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when airline does not exist", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(false);

      const filters = createMockAlertFilters({
        filters: { airlines: ["XX"] },
      });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when origin and destination are the same", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);

      const filters = createMockAlertFilters({
        route: { from: "LAX", to: "LAX" },
      });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error for negative price", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      const filters = createMockAlertFilters({
        filters: { price: -100 },
      });

      await expect(validateAlertFilters(filters)).rejects.toThrow(
        AlertValidationError,
      );
    });

    it("should throw error when only one date boundary is provided", async () => {
      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      const filters = createMockAlertFilters({
        filters: { dateTo: undefined },
      });

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

      const result = await createFlightAlert(userId, AlertType.DAILY, filters);

      expect(mockedAlertsDb.createAlert).toHaveBeenCalledWith({
        userId,
        type: AlertType.DAILY,
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

      const result = await createFlightAlert(
        userId,
        AlertType.DAILY,
        filters,
        alertEnd,
      );

      expect(mockedAlertsDb.createAlert).toHaveBeenCalledWith({
        userId,
        type: AlertType.DAILY,
        filters,
        alertEnd,
      });
      expect(result).toEqual(mockAlert);
    });

    it("should throw error for empty user ID", async () => {
      const filters = createMockAlertFilters();

      await expect(
        createFlightAlert("", AlertType.DAILY, filters),
      ).rejects.toThrow(AlertValidationError);
    });

    it("should throw error for invalid end date format", async () => {
      const userId = createMockUserId();
      const filters = createMockAlertFilters();

      mockedAlertsDb.validateAirportExists.mockResolvedValue(true);
      mockedAlertsDb.validateAirlineExists.mockResolvedValue(true);

      await expect(
        createFlightAlert(userId, AlertType.DAILY, filters, "invalid-date"),
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
        createFlightAlert(userId, AlertType.DAILY, filters, alertEnd),
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
