import { useNavigation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";

// Indica si hay una navegación o una carga de datos en curso.
export function useRoutePending(): boolean {
  const navigation = useNavigation();
  const isFetching = useIsFetching();
  return navigation.state === "loading" || isFetching > 0;
}
