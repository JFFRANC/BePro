// Helpers de test para shadcn/base-ui Select.
//
// Por qué existen: en jsdom, `userEvent.click(trigger)` NO abre el popover
// de base-ui Select (los pointer events no se propagan). El camino que sí
// funciona es enfocar el trigger y disparar la tecla Enter — además este
// camino refleja la ruta de accesibilidad real (usuarios de teclado).
//
// Uso típico:
//   const user = userEvent.setup();
//   await pickFromSelect(user, "select-rol", /administrador/i);
//
// Convención: el SelectTrigger lleva `data-testid="<id>"` para evitar
// colisiones con `getByLabelText` (la combinación id+aria-label hace que
// el label apunte a múltiples elementos en algunos casos).

import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type UserEvent = ReturnType<typeof userEvent.setup>;

/**
 * Abre un Select localizándolo por su `data-testid`. Usa el primer match
 * cuando base-ui renderiza un duplicado interno (algunos popovers expanden
 * la marca testid al fragment escondido).
 */
export async function openSelectByTestId(
  user: UserEvent,
  testId: string,
): Promise<void> {
  const trigger = screen.getAllByTestId(testId)[0] as HTMLButtonElement;
  trigger.focus();
  await user.keyboard("{Enter}");
}

/**
 * Abre un Select y elige una opción cuyo nombre accesible matchee
 * `optionText`. El `findByRole("option")` espera a que el popover renderice.
 */
export async function pickFromSelect(
  user: UserEvent,
  testId: string,
  optionText: RegExp | string,
): Promise<void> {
  await openSelectByTestId(user, testId);
  const option = await screen.findByRole("option", { name: optionText });
  await user.click(option);
}
