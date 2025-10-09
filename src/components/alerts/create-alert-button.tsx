"use client";

import { useState } from "react";
import { CreateAlertSheet } from "@/components/alerts/create-alert-sheet";
import { LoginRedirectButton } from "@/components/auth/login-redirect-button";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/hooks/use-auth-state";
import type { FlightExplorerFiltersState } from "@/hooks/use-flight-explorer";
import type { AirportData } from "@/server/services/airports";

interface CreateAlertButtonProps {
  originAirport: AirportData | null;
  destinationAirport: AirportData | null;
  filters: FlightExplorerFiltersState;
  disabled?: boolean;
}

/**
 * Smart Create Alert button that shows different behavior based on authentication status:
 * - Authenticated users: Opens alert creation sheet
 * - Unauthenticated users: Redirects to login
 */
export function CreateAlertButton({
  originAirport,
  destinationAirport,
  filters,
  disabled = false,
}: CreateAlertButtonProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { userEmail, isAuthenticated } = useAuthState(true);

  const canOpenCreate =
    Boolean(originAirport && destinationAirport) && !disabled;

  if (isAuthenticated && userEmail) {
    return (
      <CreateAlertSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        originAirport={originAirport}
        destinationAirport={destinationAirport}
        filters={filters}
        userEmail={userEmail}
        trigger={
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-2 font-semibold"
            disabled={!canOpenCreate}
          >
            + Create Alert
          </Button>
        }
      />
    );
  }

  return <LoginRedirectButton>+ Create Alert</LoginRedirectButton>;
}
