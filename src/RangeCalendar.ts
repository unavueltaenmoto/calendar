type SelectionType = 'rango' | 'día' | 'semana' | 'mes'; // 
interface RangeCalendarOptions {
    type: SelectionType; // Tipo de selección
    minDays?: number; // Días mínimos para rango
    maxDays?: number; // Días máximos para rango
    startDate?: Date; // Fecha de inicio seleccionada por defecto
    endDate?: Date; // Fecha de fin seleccionada por defecto
    minDate: Date; // Fecha mínima seleccionable
    maxDate: Date; // Fecha máxima seleccionable
    inputElement: HTMLInputElement; // Input asociado al calendario
    calendarContainer: HTMLElement; // Contenedor del calendario
    dateFormat?: string; // Formato de fecha (por ejemplo, 'YYYY-MM-DD', 'DD/MM/YYYY')
    disabledDates?: Date[]; // Fechas específicas deshabilitadas
    disableWeekends?: boolean; // Deshabilitar fines de semana
    dateSeparator?: string; // Nuevo: Separador entre fechas
    tooltipText?: { one: string; other: string }; // Texto configurable para el tooltip
    enableTooltip?: boolean; // Nuevo: Habilitar o deshabilitar el tooltip
    fechaVacia?: boolean; // Nuevo: Controla si el input debe estar vacío
    placeholder?: string; // Nuevo: Placeholder personalizado
}

class RangeCalendar {
    // Propiedades del calendario
    private readonly type: SelectionType;
    private readonly minDays: number;
    private readonly maxDays: number;
    private startDate: Date | null;
    private endDate: Date | null;
    private readonly minDate: Date;
    private readonly maxDate: Date;
    private readonly inputElement: HTMLInputElement;
    private readonly calendarContainer: HTMLElement;
    private readonly startDateInput: HTMLInputElement | null = null;
    private readonly endDateInput: HTMLInputElement | null = null;
    private dateFormat: string;
    private readonly disabledDates: Date[];
    private readonly disableWeekends: boolean;
    private readonly dateSeparator: string;
    private readonly enableTooltip: boolean;
    private readonly tooltipText: { one: string; other: string };

    // Estado interno
    private selectedDates: Date[];
    private currentMonth: number;
    private currentYear: number;
    private readonly fechaVacia: boolean;
    private readonly placeholder: string;

    // Sistema de eventos
    private events: { [key: string]: ((e: any) => void)[] };

    private isGlobalEventRegistered = false;

    constructor(options: RangeCalendarOptions) {
        // Asignar opciones
        this.type = options.type;
        this.minDays = options.minDays ?? 1;
        this.maxDays = options.maxDays ?? 30;
        this.startDate = options.startDate || null;
        this.endDate = options.endDate || null;
        this.minDate = options.minDate;
        this.maxDate = options.maxDate;
        this.inputElement = options.inputElement;
        this.calendarContainer = options.calendarContainer;
        this.dateFormat = options.dateFormat ?? 'YYYY-MM-DD';
        this.disabledDates = options.disabledDates || [];
        this.disableWeekends = options.disableWeekends || false;
        this.dateSeparator = options.dateSeparator ?? ' - ';
        this.tooltipText = options.tooltipText || { one: 'día', other: 'días' };
        this.enableTooltip = options.enableTooltip ?? true;
        this.fechaVacia = options.fechaVacia ?? true;
        this.placeholder = options.placeholder ?? 'Selecciona una fecha';
    
        // Validaciones iniciales
        if (this.minDays > this.maxDays) {
            throw new Error('minDays no puede ser mayor que maxDays.');
        }
        if (this.startDate && (this.startDate < this.minDate || this.startDate > this.maxDate)) {
            throw new Error('startDate está fuera del rango permitido.');
        }
        if (this.endDate && (this.endDate < this.minDate || this.endDate > this.maxDate)) {
            throw new Error('endDate está fuera del rango permitido.');
        }

        if (this.type === 'día') {
            this.endDate = null; // Asegurarse de que no haya un rango definido
        }
    
        // Inicializar estado interno
        this.selectedDates = [];
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
    
        this.selectDate = this.selectDate.bind(this);
        // Inicializar sistema de eventos
        this.events = {};
    
        // Inicializar el calendario
        this.init();
    
        // Actualizar el input después de la inicialización
        this.updateInput();
    }

    private init(): void {
        this.dateFormat = this.dateFormat || 'YYYY-MM-DD';
    
        // Adjuntar eventos al input principal
        this.attachInputEvents();
    
        // Renderizar el calendario al inicializar
        this.renderCalendar();

        // Actualizar los inputs con las fechas por defecto
        if (this.startDate) {
            this.updateInput();
        }
    
        // Ocultar el calendario después de la inicialización
        this.calendarContainer.style.display = 'none';
    
        // Actualizar el input con las fechas iniciales
        this.updateInput();
    
        // Emitir el evento renderCompleted después de la inicialización
        this.emit('renderCompleted', {
            startDate: this.startDate,
            endDate: this.endDate
        });
    
    }

    public on(event: string, callback: (e: any) => void): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    private emit(event: string, data: any): void {
        if (this.events[event]) {
            const sanitizedData = JSON.parse(JSON.stringify(data));
    
            // Restaurar las fechas como instancias de Date
            if (sanitizedData.startDate) {
                sanitizedData.startDate = new Date(sanitizedData.startDate);
            }
            if (sanitizedData.endDate) {
                sanitizedData.endDate = new Date(sanitizedData.endDate);
            }
    
            this.events[event].forEach(callback => {
                try {
                    callback(sanitizedData);
                } catch (error) {
                    console.error(`Error en el callback del evento ${event}:`, error);
                }
            });
        }
    }

    private clearDynamicEvents(): void {
        const cells = this.calendarContainer.querySelectorAll('.calendar-day, .calendar-month');
        cells.forEach(cell => {
            const newCell = cell.cloneNode(true);
            cell.replaceWith(newCell);
        });
    }

    private renderCalendar(): void {
        this.clearDynamicEvents();
        this.calendarContainer.replaceChildren();
        this.adjustContainerWidth();
        this.renderHeader();
        this.renderTable();
        this.disableOutOfRangeDatesIfNeeded();
    
        // Aplicar las clases de resaltado para las fechas por defecto
        this.applyHighlightClasses();
    
        this.triggerRenderCompleted();
    }

    private adjustContainerWidth(): void {
        if (this.type === 'mes') {
            this.calendarContainer.classList.add('calendar-container--month');
        } else {
            this.calendarContainer.classList.remove('calendar-container--month');
        }
    }

    private renderHeader(): void {
        const header = document.createElement('div');
        header.className = 'calendar-header';

        const prevButton = this.createNavigationButton('rounded-circle mo-i-arrow-ios-back pl-1 pr-2 py-1 border border-light', () => this.navigate(-1));
        const nextButton = this.createNavigationButton('rounded-circle mo-i-arrow-ios-forward pl-2 pr-1 py-1 border border-light', () => this.navigate(1));
        const monthYearDisplay = this.createMonthYearDisplay();

        header.appendChild(prevButton);
        header.appendChild(monthYearDisplay);
        header.appendChild(nextButton);
        this.calendarContainer.appendChild(header);
    }

    private createNavigationButton(text: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = text;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            onClick();
        });
        return button;
    }

    private createMonthYearDisplay(): HTMLSpanElement {
        const span = document.createElement('span');
        span.textContent = this.type === 'mes'
            ? `${this.currentYear}`
            : `${this.getMonthName(this.currentMonth)} ${this.currentYear}`;
        return span;
    }

    private navigate(offset: number): void {
        if (this.type === 'mes') {
            this.changeYear(offset);
        } else {
            this.changeMonth(offset);
        }
    }

    private renderTable(): void {
        const table = document.createElement('table');
        table.className = this.type === 'mes' ? 'calendar-table-months' : 'calendar-table';

        if (this.type === 'mes') {
            this.renderMonthTable(table);
        } else {
            this.renderDayTable(table);
        }

        this.calendarContainer.appendChild(table);
    }

    private renderMonthTable(table: HTMLTableElement): void {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'];
        months.forEach((month, index) => {
            const cell = this.createMonthCell(month, index);
            table.appendChild(cell);
        });
    }

    private createMonthCell(month: string, index: number): HTMLDivElement {
        const cell = document.createElement('div');
        cell.setAttribute('role', 'button');
        cell.setAttribute('aria-label', `Seleccionar ${month} ${this.currentYear}`);
        cell.setAttribute('data-month', index.toString()); // Agregar el mes como atributo
        cell.setAttribute('data-year', this.currentYear.toString()); // Agregar el año como atributo
        cell.textContent = month;
        cell.className = 'calendar-month';
    
        const monthDate = new Date(this.currentYear, index, 1);
        const endOfMonth = new Date(this.currentYear, index + 1, 0);
    
        if (monthDate > this.maxDate || endOfMonth < this.minDate) {
            cell.classList.add('disabled');
        } else {
            cell.addEventListener('click', () => this.selectDate(monthDate));
        }
    
        return cell;
    }

    private renderDayTable(table: HTMLTableElement): void {
        this.renderDayTableHeader(table);
        this.renderDayTableBody(table);
    
        // Aplicar las clases de resaltado después de renderizar la tabla
        this.applyHighlightClasses();
    }

    private applyHighlightClasses(): void {
        if (!this.startDate) return;
    
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
        const startDate = this.normalizeDate(this.startDate);
        const endDate = this.endDate ? this.normalizeDate(this.endDate) : null;
    
        cells.forEach((cell) => {
            const day = parseInt(cell.textContent ?? '0', 10);
            if (isNaN(day) || day === 0) return;
    
            const cellDate = this.normalizeDate(new Date(this.currentYear, this.currentMonth, day));
            const cellMonth = cell.getAttribute('data-month');
            const cellYear = cell.getAttribute('data-year');

            // Limpiar clases previas
            cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
    
            // Aplicar las clases correspondientes según el tipo
            if (this.type === 'día') {
                if (cellDate.getTime() === startDate.getTime()) {
                    cell.classList.add('highlight-start');
                }
            } else if (this.type === 'rango' || this.type === 'semana') {
                if (cellDate.getTime() === startDate.getTime()) {
                    cell.classList.add('highlight-start');
                } else if (endDate && cellDate.getTime() === endDate.getTime()) {
                    cell.classList.add('highlight-end');
                } else if (endDate && cellDate > startDate && cellDate < endDate) {
                    cell.classList.add('highlight-range');
                }
            } else if (this.type === 'mes' && cellMonth && cellYear) {
                const cellDate = new Date(parseInt(cellYear, 10), parseInt(cellMonth, 10), 1);

                if (cellDate.getFullYear() === startDate.getFullYear() && cellDate.getMonth() === startDate.getMonth()) {
                    cell.classList.add('highlight-start');
                }
            }
        });
    }

    private renderDayTableHeader(table: HTMLTableElement): void {
        const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const headerRow = document.createElement('tr');
        daysOfWeek.forEach(day => {
            const th = document.createElement('th');
            th.textContent = day;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
    }

    private renderDayTableBody(table: HTMLTableElement): void {
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        let date = 1;
        for (let i = 0; i < 6; i++) {
            const row = document.createElement('tr');
            for (let j = 0; j < 7; j++) {
                const cell = this.createDayCell(date, i, j, firstDay, daysInMonth);
                row.appendChild(cell);
                if (cell.textContent) date++;
            }
            table.appendChild(row);
        }
    }

    private createDayCell(date: number, i: number, j: number, firstDay: number, daysInMonth: number): HTMLTableCellElement {
        const cell = document.createElement('td');

        if (i === 0 && j < (firstDay === 0 ? 6 : firstDay - 1) || date > daysInMonth) {
            cell.textContent = '';
        } else {
            const currentDate = new Date(this.currentYear, this.currentMonth, date);
            this.configureDayCell(cell, currentDate, date);
        }

        return cell;
    }

    private configureDayCell(cell: HTMLTableCellElement, currentDate: Date, date: number): void {
        const isDisabled = this.isDateDisabled(currentDate);
    
        if (!isDisabled) {
            cell.textContent = date.toString();
            cell.className = 'calendar-day';
    
            // Pasar explícitamente la fecha al método selectDate
            cell.addEventListener('click', () => this.selectDate(currentDate));
    
            this.addHighlightEvents(cell, currentDate);
        } else {
            cell.textContent = date.toString();
            cell.className = 'calendar-day disabled';
        }
    }
    private isDateDisabled(date: Date): boolean {
        const normalizedDate = this.normalizeDate(date);
        const normalizedMinDate = this.normalizeDate(this.minDate);
        const normalizedMaxDate = this.normalizeDate(this.maxDate);

        return normalizedDate < normalizedMinDate || normalizedDate > normalizedMaxDate ||
            this.disabledDates.some(d => this.normalizeDate(d).getTime() === normalizedDate.getTime()) ||
            (this.disableWeekends && (normalizedDate.getDay() === 0 || normalizedDate.getDay() === 6));
    }

    private addHighlightEvents(cell: HTMLTableCellElement, date: Date): void {
        if (this.type === 'semana') {
            cell.addEventListener('mouseover', () => this.highlightWeek(date));
            cell.addEventListener('mouseout', () => this.clearHighlight());
        }

        if (this.type === 'rango') {
            cell.addEventListener('mouseover', (event) => this.highlightRange(date, event));
            cell.addEventListener('mouseout', () => {
                this.clearHighlight();
                this.hideTooltip();
            });
        }
    }

    private disableOutOfRangeDatesIfNeeded(): void {
        if (this.selectedDates.length > 0) {
            this.disableOutOfRangeDates(this.selectedDates[0]);
        }
    }

    private attachInputEvents(): void {
        if (!this.isGlobalEventRegistered) {
            document.addEventListener('click', this.globalClickHandler);
            this.isGlobalEventRegistered = true;
        }

        // Mostrar el calendario al hacer clic en el input
        this.inputElement.addEventListener('focus', () => {
            this.renderCalendar();
    
            // Restablecer días deshabilitados al abrir el calendario
            const cells = this.calendarContainer.querySelectorAll('.calendar-day');
            cells.forEach((cell) => {
                const day = parseInt(cell.textContent ?? '0', 10);
                if (isNaN(day) || day === 0) return;
    
                const cellDate = new Date(this.currentYear, this.currentMonth, day);
    
                // Verificar si la fecha está dentro del rango permitido
                const isDisabled = cellDate < this.minDate || cellDate > this.maxDate ||
                    this.disabledDates.some(d => d.getTime() === cellDate.getTime()) ||
                    (this.disableWeekends && (cellDate.getDay() === 0 || cellDate.getDay() === 6));
    
                if (!isDisabled) {
                    cell.classList.remove('disabled');
                    cell.addEventListener('click', this.selectDate as any); // Rehabilitar selección
                } else {
                    cell.classList.add('disabled');
                    cell.removeEventListener('click', this.selectDate as any); // Evitar selección
                }
            });
    
            this.calendarContainer.style.display = 'block';
            this.calendarContainer.classList.add('open'); // Animación opcional
            this.emit('calendarOpened', {});
        });
    
        // Detener la propagación de clics dentro del contenedor del calendario
        this.calendarContainer.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    
        // Ocultar el calendario al hacer clic fuera
        document.addEventListener('click', (event) => {
            if (!this.calendarContainer.contains(event.target as Node) &&
                event.target !== this.inputElement) {
                this.calendarContainer.style.display = 'none';
                this.calendarContainer.classList.remove('open'); // Animación opcional
                this.emit('calendarClosed', {});
            }
        });
    }

    private changeMonth(offset: number): void {
        this.currentMonth += offset;
    
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
    
        this.renderCalendar();
    
        // Deshabilitar días fuera del rango permitido si hay una fecha seleccionada
        if (this.selectedDates.length > 0) {
            this.disableOutOfRangeDates(this.selectedDates[0]);
        }
    }

    private getMonthName(month: number): string {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[month];
    }

    private selectDate(date: Date): void {
        if (!(date instanceof Date)) {
            console.error('El argumento proporcionado no es una instancia de Date:', date);
            return;
        }
    
        if (!this.validateDate(date)) {
            console.error('Fecha inválida proporcionada.');
            return;
        }
    
        if (date < this.minDate || date > this.maxDate) {
            console.error('La fecha seleccionada está fuera del rango permitido.');
            return;
        }
    
        if (this.type === 'día') {
            // Selección de un solo día
            this.selectedDates = [date];
            this.startDate = date;
            this.endDate = null;
            this.updateInput();
            this.calendarContainer.style.display = 'none'; // Ocultar el calendario
            this.emit('dateSelected', { date });
        } else if (this.type === 'rango') {
            // Selección de rango
            if (this.selectedDates.length === 0 || this.selectedDates.length === 2) {
                // Iniciar un nuevo rango
                this.selectedDates = [date];
                this.startDate = date;
                this.endDate = null;
    
                // Aplicar highlight-start a la fecha inicial
                const cells = this.calendarContainer.querySelectorAll('.calendar-day');
                cells.forEach((cell) => {
                    const cellDate = new Date(this.currentYear, this.currentMonth, parseInt(cell.textContent ?? '0', 10));
                    cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
                    if (cellDate.getTime() === date.getTime()) {
                        cell.classList.add('highlight-start');
                    }
                });
    
                this.disableOutOfRangeDates(date); // Actualizar días deshabilitados
            } else {
                // Completar el rango
                if (date < this.selectedDates[0]) {
                    console.error('La fecha final no puede ser anterior a la fecha inicial.');
                    return;
                }
    
                this.selectedDates.push(date);
                this.selectedDates.sort((a, b) => a.getTime() - b.getTime());
                this.startDate = this.selectedDates[0];
                this.endDate = this.selectedDates[1];
    
                this.updateInput();
                this.calendarContainer.style.display = 'none'; // Ocultar el calendario
                this.emit('rangeSelected', {
                    startDate: this.startDate,
                    endDate: this.endDate
                });
            }
        } else if (this.type === 'semana') {
            // Selección de semana
            const startOfWeek = this.getStartOfWeek(date);
            const endOfWeek = this.getEndOfWeek(date);
            this.selectedDates = [startOfWeek, endOfWeek];
            this.startDate = startOfWeek;
            this.endDate = endOfWeek;
    
            this.updateInput();
            this.calendarContainer.style.display = 'none'; // Ocultar el calendario
            this.emit('weekSelected', {
                startDate: this.startDate,
                endDate: this.endDate
            });
        } else if (this.type === 'mes') {
            // Selección de mes
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
            // Ajustar el rango según maxDate
            const adjustedEndOfMonth = endOfMonth > this.maxDate ? this.maxDate : endOfMonth;
    
            this.selectedDates = [startOfMonth, adjustedEndOfMonth];
            this.startDate = startOfMonth;
            this.endDate = adjustedEndOfMonth;
    
            this.updateInput();
            this.calendarContainer.style.display = 'none'; // Ocultar el calendario
            this.emit('monthSelected', {
                startDate: this.startDate,
                endDate: this.endDate
            });
        }
    }

    /**
     * Deshabilita las fechas fuera del rango permitido basado en la fecha seleccionada.
     * @param selectedDate Fecha inicial seleccionada.
     */
    private disableOutOfRangeDates(selectedDate: Date): void {
        if (this.type !== 'rango') {
            return; // No aplicar deshabilitación para 'día' o 'semana'
        }
    
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
    
        const minAllowedDate = new Date(selectedDate);
        minAllowedDate.setDate(minAllowedDate.getDate() + this.minDays - 1);
    
        const maxAllowedDate = new Date(selectedDate);
        maxAllowedDate.setDate(maxAllowedDate.getDate() + this.maxDays - 1);
    
        cells.forEach((cell) => {
            const day = parseInt(cell.textContent ?? '0', 10);
            if (isNaN(day) || day === 0) return;
    
            const cellDate = new Date(this.currentYear, this.currentMonth, day);
    
            // Deshabilitar días fuera del rango permitido
            if (cellDate < selectedDate || cellDate < minAllowedDate || cellDate > maxAllowedDate) {
                cell.classList.add('disabled');
                cell.removeEventListener('click', this.selectDate as any); // Evitar selección
            }
        });
    }

    private getStartOfWeek(date: Date): Date {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    }

    private getEndOfWeek(date: Date): Date {
        const startOfWeek = this.getStartOfWeek(date);
        return new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
    }

    private updateInput(): void {
        if (this.fechaVacia) {
            this.setPlaceholder();
        } else {
            switch (this.type) {
                case 'mes':
                    this.updateMonthInput();
                    break;
                case 'rango':
                case 'semana':
                    this.updateRangeOrWeekInput();
                    break;
                case 'día':
                    this.updateDayInput();
                    break;
            }
        }
    }

    private setPlaceholder(): void {
        this.inputElement.value = '';
        this.inputElement.placeholder = this.placeholder;
    }

    private updateMonthInput(): void {
        if (this.startDate && this.endDate) {
            const monthNames = [
                'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'
            ];
            const startMonth = monthNames[this.startDate.getMonth()];
            const year = this.startDate.getFullYear();
            this.inputElement.value = `${startMonth} ${year}`;
        } else {
            this.inputElement.value = '';
        }
    }

    private updateRangeOrWeekInput(): void {
        if (this.startDate && this.endDate) {
            const startDate = this.formatDate(this.startDate);
            const endDate = this.formatDate(this.endDate);
            this.inputElement.value = `${startDate}${this.dateSeparator}${endDate}`;
            if (this.startDateInput) this.startDateInput.value = startDate;
            if (this.endDateInput) this.endDateInput.value = endDate;
        } else {
            this.inputElement.value = '';
        }
    }

    private updateDayInput(): void {
        if (this.startDate) {
            const date = this.formatDate(this.startDate);
            this.inputElement.value = date;
            if (this.startDateInput) this.startDateInput.value = date;
            if (this.endDateInput) this.endDateInput.value = '';
        } else {
            this.inputElement.value = '';
        }
    }

    /**
     * Formatea una fecha según el formato proporcionado o el formato configurado.
     * @param date Fecha a formatear.
     * @param format (Opcional) Formato a usar. Si no se proporciona, se usa el formato configurado.
     * @returns Fecha formateada como string.
     */
    private formatDate(date: Date, format?: string): string {
        if (!(date instanceof Date)) {
            console.error('El argumento proporcionado a formatDate no es una instancia de Date:', date);
            return '';
        }
    
        const day = String(date.getDate()).padStart(2, '0');
        const monthNames = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];
        const month = monthNames[date.getMonth()];
        const numericMonth = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
    
        // Usar el formato proporcionado o el configurado
        const dateFormat = format ?? this.dateFormat;
    
        // Manejar diferentes formatos
        switch (dateFormat) {
            case 'DD MMM YYYY':
                return `${day} ${month} ${year}`;
            case 'YYYY-MM-DD':
                return `${year}-${numericMonth}-${day}`;
            case 'DD/MM/YYYY':
                return `${day}/${numericMonth}/${year}`;
            case 'MM/DD/YYYY':
                return `${numericMonth}/${day}/${year}`;
            case 'YYYY/MM/DD':
                return `${year}/${numericMonth}/${day}`;
            default:
                // Formato predeterminado
                return `${year}-${numericMonth}-${day}`;
        }
    }

    /**
     * Limpia las fechas seleccionadas y actualiza el calendario.
     */
    public clearSelection(): void {
        this.selectedDates = [];
        this.updateInput();
        this.renderCalendar(); // Vuelve a renderizar el calendario para habilitar todas las fechas
    }

    /**
     * Devuelve las fechas seleccionadas en un formato específico.
     * @returns Un objeto con las fechas seleccionadas (inicio y fin).
     */
    public getSelectedDates(): { startDate: string | null; endDate: string | null } {
        const startDate = this.selectedDates[0] ? this.formatDate(this.selectedDates[0]) : null;
        const endDate = this.selectedDates[1] ? this.formatDate(this.selectedDates[1]) : null;
        return { startDate, endDate };
    }

    /**
     * Resalta los días de la semana correspondiente a la fecha proporcionada.
     * @param date Fecha para calcular la semana.
     */
    private highlightWeek(date: Date): void {
        const startOfWeek = this.getStartOfWeek(date);
        const endOfWeek = this.getEndOfWeek(date);
    
        // Validar el rango máximo permitido
        const diff = Math.abs(Math.ceil((endOfWeek.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24))) + 1;
        if (this.maxDays && diff > this.maxDays) {
            return; // No resaltar la semana si excede el rango máximo
        }
    
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
        cells.forEach((cell) => {
            const cellDate = new Date(this.currentYear, this.currentMonth, parseInt(cell.textContent ?? '0', 10));
    
            // Limpiar clases previas
            cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
    
            // Aplicar las clases correspondientes
            if (cellDate.getTime() === startOfWeek.getTime()) {
                cell.classList.add('highlight-start');
            } else if (cellDate.getTime() === endOfWeek.getTime()) {
                cell.classList.add('highlight-end');
            } else if (cellDate > startOfWeek && cellDate < endOfWeek) {
                cell.classList.add('highlight-range');
            }
        });
    }

    /**
     * Resalta los días dentro del rango dinámico al mover el mouse.
     * @param endDate Fecha final del rango.
     */
    private highlightRange(endDate: Date, event?: MouseEvent): void {
        if (this.selectedDates.length === 0) {
            this.hideTooltip(); // Ocultar el tooltip si no hay una fecha de inicio seleccionada
            return;
        }
    
        const startDate = this.selectedDates[0];
    
        // Calcular la diferencia en días
        const diff = Math.abs(Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) + 1;
    
        // Validar el rango máximo permitido
        if (this.maxDays && diff > this.maxDays) {
            this.hideTooltip(); // Ocultar el tooltip si el rango excede el máximo permitido
            return;
        }
    
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
    
        cells.forEach((cell) => {
            const cellDate = new Date(this.currentYear, this.currentMonth, parseInt(cell.textContent ?? '0', 10));
    
            // Limpiar clases previas
            cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
    
            // Aplicar las clases correspondientes
            if (cellDate.getTime() === startDate.getTime()) {
                cell.classList.add('highlight-start');
            } else if (cellDate.getTime() === endDate.getTime()) {
                cell.classList.add('highlight-end');
            } else if (cellDate > startDate && cellDate < endDate) {
                cell.classList.add('highlight-range');
            }
        });
    
        // Mostrar el tooltip solo si está habilitado
        if (this.enableTooltip && event) {
            const text = diff === 1 ? `${diff} ${this.tooltipText.one}` : `${diff} ${this.tooltipText.other}`;
            const targetCell = event.target as HTMLElement;
            this.showTooltip(text, event.clientX, event.clientY, targetCell);
        }
    }

    /**
     * Muestra un tooltip con el número de días seleccionados.
     * @param text Texto a mostrar en el tooltip.
     * @param x Posición X del mouse.
     * @param y Posición Y del mouse.
     */
    private showTooltip(text: string, x: number, y: number, targetCell: HTMLElement): void {
        let tooltip = document.querySelector('.calendar-tooltip') as HTMLElement;
    
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'calendar-tooltip';
            this.calendarContainer.appendChild(tooltip);
        }
    
        // Actualizar el contenido del tooltip
        tooltip.textContent = text;
    
        // Asegurarse de que el tooltip esté visible para calcular su tamaño
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'hidden'; // Ocultarlo temporalmente para evitar parpadeos
    
        // Obtener las coordenadas de la celda
        const cellRect = targetCell.getBoundingClientRect();
        const calendarRect = this.calendarContainer.getBoundingClientRect();
    
        // Calcular la posición del tooltip
        const tooltipX = cellRect.left - calendarRect.left + (cellRect.width / 2) - (tooltip.offsetWidth / 2);
        const tooltipY = cellRect.top - calendarRect.top - tooltip.offsetHeight - 5; // Ajustar para que quede encima
    
        // Aplicar las coordenadas calculadas
        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;
        tooltip.style.visibility = 'visible'; // Hacerlo visible nuevamente
    }

    /**
     * Oculta el tooltip.
     */
    private hideTooltip(): void {
        const tooltip = document.querySelector('.calendar-tooltip') as HTMLElement;
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    /**
     * Limpia el resaltado de los días de la semana.
     */
    private clearHighlight(): void {
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
        cells.forEach((cell) => {
            cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
        });
    }

    /**
     * Fuerza la emisión del evento renderCompleted.
     */
    public triggerRenderCompleted(): void {
        this.emit('renderCompleted', {
            startDate: this.startDate,
            endDate: this.endDate
        });
    }

    /**
     * Normaliza una fecha estableciendo la hora a 00:00:00 en UTC.
     * @param date Fecha a normalizar.
     * @returns Fecha normalizada.
     */
    private normalizeDate(date: Date): Date {
        const normalizedDate = new Date(date);
        normalizedDate.setUTCHours(0, 0, 0, 0); // Establecer la hora en UTC
        return normalizedDate;
    }

    private changeYear(offset: number): void {
        this.currentYear += offset;
        this.renderCalendar();
    }

    private validateDate(date: any): boolean {
        if (!(date instanceof Date)) {
            console.error('El argumento proporcionado no es una instancia de Date:', date);
            return false;
        }
    
        const normalizedDate = this.normalizeDate(date);
        console.log('Validando fecha normalizada:', normalizedDate);
        return normalizedDate instanceof Date && !isNaN(normalizedDate.getTime());
    }

    public destroy(): void {
        document.removeEventListener('click', this.globalClickHandler);
        this.calendarContainer.replaceChildren(); // Limpia el contenedor
        this.events = {}; // Limpia los eventos registrados
        console.log('RangeCalendar destruido.');
    }
    
    private readonly globalClickHandler = (event: MouseEvent): void => {
        if (!this.calendarContainer.contains(event.target as Node) &&
            event.target !== this.inputElement) {
            this.calendarContainer.style.display = 'none';
            this.calendarContainer.classList.remove('open');
            this.emit('calendarClosed', {});
        }
    };

}

export default RangeCalendar;