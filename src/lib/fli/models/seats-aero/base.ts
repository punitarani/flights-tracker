/**
 * Base models and enums for seats.aero API.
 *
 * This module contains shared types used across different seats.aero endpoints.
 */

import { z } from "zod";

/**
 * Available cabin classes in airline award bookings.
 * These correspond to the cabin class codes used by airlines.
 */
export enum CabinClass {
  /** Economy / Coach class (Y) */
  ECONOMY = "economy",
  /** Premium Economy class (W) */
  PREMIUM_ECONOMY = "premium_economy",
  /** Business class (J) */
  BUSINESS = "business",
  /** First class (F) */
  FIRST = "first",
}

export enum CabinClassCode {
  ECONOMY = "Y",
  PREMIUM_ECONOMY = "W",
  BUSINESS = "J",
  FIRST = "F",
}

/**
 * Supported source programs/airlines for award availability.
 * These represent the different frequent flyer programs that can be searched.
 */
export enum Source {
  EUROBONUS = "eurobonus",
  VIRGIN_ATLANTIC = "virginatlantic",
  AEROMEXICO = "aeromexico",
  AMERICAN = "american",
  DELTA = "delta",
  ETIHAD = "etihad",
  UNITED = "united",
  EMIRATES = "emirates",
  AEROPLAN = "aeroplan",
  ALASKA = "alaska",
  VELOCITY = "velocity",
  QANTAS = "qantas",
  CONNECT_MILES = "connectmiles",
  AZUL = "azul",
  SMILES = "smiles",
  FLYING_BLUE = "flyingblue",
  JETBLUE = "jetblue",
  QATAR = "qatar",
  TURKISH = "turkish",
  SINGAPORE = "singapore",
  ETHIOPIAN = "ethiopian",
  SAUDIA = "saudia",
  FINNAIR = "finnair",
  LUFTHANSA = "lufthansa",
}

/**
 * Geographic regions for airport classification.
 */
export enum Region {
  NORTH_AMERICA = "North America",
  EUROPE = "Europe",
  ASIA = "Asia",
  OCEANIA = "Oceania",
  SOUTH_AMERICA = "South America",
  AFRICA = "Africa",
  MIDDLE_EAST = "Middle East",
  CARIBBEAN = "Caribbean",
}

/**
 * Currency codes supported by the API.
 *
 * ISO-4217 currency codes.
 */
export enum Currency {
  AED = "AED",
  AFN = "AFN",
  ALL = "ALL",
  AMD = "AMD",
  AOA = "AOA",
  ARS = "ARS",
  AUD = "AUD",
  AWG = "AWG",
  AZN = "AZN",
  BAM = "BAM",
  BBD = "BBD",
  BDT = "BDT",
  BGN = "BGN",
  BHD = "BHD",
  BIF = "BIF",
  BMD = "BMD",
  BND = "BND",
  BOB = "BOB",
  BOV = "BOV",
  BRL = "BRL",
  BSD = "BSD",
  BTN = "BTN",
  BWP = "BWP",
  BYN = "BYN",
  BZD = "BZD",
  CAD = "CAD",
  CDF = "CDF",
  CHE = "CHE",
  CHF = "CHF",
  CHW = "CHW",
  CLF = "CLF",
  CLP = "CLP",
  CNY = "CNY",
  COP = "COP",
  COU = "COU",
  CRC = "CRC",
  CUP = "CUP",
  CVE = "CVE",
  CZK = "CZK",
  DJF = "DJF",
  DKK = "DKK",
  DOP = "DOP",
  DZD = "DZD",
  EGP = "EGP",
  ERN = "ERN",
  ETB = "ETB",
  EUR = "EUR",
  FJD = "FJD",
  FKP = "FKP",
  GBP = "GBP",
  GEL = "GEL",
  GHS = "GHS",
  GIP = "GIP",
  GMD = "GMD",
  GNF = "GNF",
  GTQ = "GTQ",
  GYD = "GYD",
  HKD = "HKD",
  HNL = "HNL",
  HTG = "HTG",
  HUF = "HUF",
  IDR = "IDR",
  ILS = "ILS",
  INR = "INR",
  IQD = "IQD",
  IRR = "IRR",
  ISK = "ISK",
  JMD = "JMD",
  JOD = "JOD",
  JPY = "JPY",
  KES = "KES",
  KGS = "KGS",
  KHR = "KHR",
  KMF = "KMF",
  KPW = "KPW",
  KRW = "KRW",
  KWD = "KWD",
  KYD = "KYD",
  KZT = "KZT",
  LAK = "LAK",
  LBP = "LBP",
  LKR = "LKR",
  LRD = "LRD",
  LSL = "LSL",
  LYD = "LYD",
  MAD = "MAD",
  MDL = "MDL",
  MGA = "MGA",
  MKD = "MKD",
  MMK = "MMK",
  MNT = "MNT",
  MOP = "MOP",
  MRU = "MRU",
  MUR = "MUR",
  MVR = "MVR",
  MWK = "MWK",
  MXN = "MXN",
  MXV = "MXV",
  MYR = "MYR",
  MZN = "MZN",
  NAD = "NAD",
  NGN = "NGN",
  NIO = "NIO",
  NOK = "NOK",
  NPR = "NPR",
  NZD = "NZD",
  OMR = "OMR",
  PAB = "PAB",
  PEN = "PEN",
  PGK = "PGK",
  PHP = "PHP",
  PKR = "PKR",
  PLN = "PLN",
  PYG = "PYG",
  QAR = "QAR",
  RON = "RON",
  RSD = "RSD",
  RUB = "RUB",
  RWF = "RWF",
  SAR = "SAR",
  SBD = "SBD",
  SCR = "SCR",
  SDG = "SDG",
  SEK = "SEK",
  SGD = "SGD",
  SHP = "SHP",
  SLL = "SLL",
  SOS = "SOS",
  SRD = "SRD",
  SSP = "SSP",
  STN = "STN",
  SVC = "SVC",
  SYP = "SYP",
  SZL = "SZL",
  THB = "THB",
  TJS = "TJS",
  TMT = "TMT",
  TND = "TND",
  TOP = "TOP",
  TRY = "TRY",
  TTD = "TTD",
  TWD = "TWD",
  TZS = "TZS",
  UAH = "UAH",
  UGX = "UGX",
  USD = "USD",
  USN = "USN",
  UYI = "UYI",
  UYU = "UYU",
  UYW = "UYW",
  UZS = "UZS",
  VES = "VES",
  VED = "VED",
  VND = "VND",
  VUV = "VUV",
  WST = "WST",
  XAF = "XAF",
  XAG = "XAG",
  XAU = "XAU",
  XBA = "XBA",
  XBB = "XBB",
  XBC = "XBC",
  XBD = "XBD",
  XCD = "XCD",
  XDR = "XDR",
  XOF = "XOF",
  XPD = "XPD",
  XPF = "XPF",
  XPT = "XPT",
  XSU = "XSU",
  XTS = "XTS",
  XUA = "XUA",
  XXX = "XXX",
  YER = "YER",
  ZAR = "ZAR",
  ZMW = "ZMW",
  ZWL = "ZWL",
}

/**
 * Base schema for cabin availability data.
 * Contains fields common to all cabin classes (Y, W, J, F).
 */
export const CabinAvailabilitySchema = z.object({
  /** Whether award seats are available in this cabin */
  available: z.boolean(),
  /** Raw availability flag (unprocessed) */
  availableRaw: z.boolean(),
  /** Mileage cost as string */
  mileageCost: z.string(),
  /** Mileage cost as number */
  mileageCostRaw: z.number(),
  /** Mileage cost for direct flights only */
  directMileageCost: z.number(),
  /** Raw mileage cost for direct flights */
  directMileageCostRaw: z.number(),
  /** Total taxes and fees */
  totalTaxes: z.number(),
  /** Raw total taxes */
  totalTaxesRaw: z.number(),
  /** Total taxes for direct flights */
  directTotalTaxes: z.number(),
  /** Raw total taxes for direct flights */
  directTotalTaxesRaw: z.number(),
  /** Number of remaining award seats */
  remainingSeats: z.number(),
  /** Raw remaining seats count */
  remainingSeatsRaw: z.number(),
  /** Remaining seats on direct flights */
  directRemainingSeats: z.number(),
  /** Raw remaining seats on direct flights */
  directRemainingSeatsRaw: z.number(),
  /** Operating airline codes (comma-separated) */
  airlines: z.string(),
  /** Raw airline codes */
  airlinesRaw: z.string(),
  /** Airline codes for direct flights */
  directAirlines: z.string(),
  /** Raw airline codes for direct flights */
  directAirlinesRaw: z.string(),
  /** Whether direct flights are available */
  direct: z.boolean(),
  /** Raw direct flight availability */
  directRaw: z.boolean(),
});

export type CabinAvailability = z.infer<typeof CabinAvailabilitySchema>;
