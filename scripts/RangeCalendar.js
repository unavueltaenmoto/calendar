class RangeCalendar {
    constructor(options) {
        this.startDateInput = null;
        this.endDateInput = null;
        this.isGlobalEventRegistered = false;
        this.globalClickHandler = (event) => {
            if (!this.calendarContainer.contains(event.target) &&
                event.target !== this.inputElement) {
                this.calendarContainer.style.display = 'none';
                this.calendarContainer.classList.remove('open');
                this.emit('calendarClosed', {});
            }
        };
        // Asignar opciones
        this.type = options.type;
        this.minDays = options.minDays || 1;
        this.maxDays = options.maxDays || 30;
        this.startDate = options.startDate || null;
        this.endDate = options.endDate || null;
        this.minDate = options.minDate;
        this.maxDate = options.maxDate;
        this.inputElement = options.inputElement;
        this.calendarContainer = options.calendarContainer;
        this.dateFormat = options.dateFormat || 'YYYY-MM-DD';
        this.disabledDates = options.disabledDates || [];
        this.disableWeekends = options.disableWeekends || false;
        this.dateSeparator = options.dateSeparator || ' - ';
        this.tooltipText = options.tooltipText || { one: 'día', other: 'días' };
        this.enableTooltip = options.enableTooltip !== undefined ? options.enableTooltip : true;
        this.fechaVacia = options.fechaVacia !== undefined ? options.fechaVacia : true;
        this.placeholder = options.placeholder || 'Selecciona una fecha';
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
        // Inicializar estado interno
        this.selectedDates = [];
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        // Inicializar sistema de eventos
        this.events = {};
        // Inicializar el calendario
        this.init();
        // Actualizar el input después de la inicialización
        this.updateInput();
    }
    init() {
        this.dateFormat = this.dateFormat || 'YYYY-MM-DD';
        // Adjuntar eventos al input principal
        this.attachInputEvents();
        // Renderizar el calendario al inicializar
        this.renderCalendar();
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
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }
    emit(event, data) {
        if (this.events[event]) {
            const sanitizedData = JSON.parse(JSON.stringify(data)); // Sanitizar datos
            this.events[event].forEach(callback => {
                try {
                    callback(sanitizedData);
                }
                catch (error) {
                    console.error(`Error en el callback del evento ${event}:`, error);
                }
            });
        }
    }
    clearDynamicEvents() {
        const cells = this.calendarContainer.querySelectorAll('.calendar-day, .calendar-month');
        cells.forEach(cell => {
            const newCell = cell.cloneNode(true);
            cell.replaceWith(newCell);
        });
    }
    renderCalendar() {
        this.clearDynamicEvents(); // Limpia los eventos dinámicos
        // Limpia el contenedor del calendario
        this.calendarContainer.replaceChildren();
        // Ajustar el ancho del contenedor según el tipo
        if (this.type === 'mes') {
            this.calendarContainer.classList.add('calendar-container--month');
        }
        else {
            this.calendarContainer.classList.remove('calendar-container--month');
        }
        // Crear encabezado con controles de navegación
        const header = document.createElement('div');
        header.className = 'calendar-header';
        const prevButton = document.createElement('button');
        prevButton.textContent = '<';
        prevButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.type === 'mes') {
                this.changeYear(-1); // Cambiar el año en lugar del mes
            }
            else {
                this.changeMonth(-1); // Cambiar el mes
            }
        });
        const nextButton = document.createElement('button');
        nextButton.textContent = '>';
        nextButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.type === 'mes') {
                this.changeYear(1); // Cambiar el año en lugar del mes
            }
            else {
                this.changeMonth(1); // Cambiar el mes
            }
        });
        const monthYearDisplay = document.createElement('span');
        if (this.type === 'mes') {
            monthYearDisplay.textContent = `${this.currentYear}`;
        }
        else {
            monthYearDisplay.textContent = `${this.getMonthName(this.currentMonth)} ${this.currentYear}`;
        }
        header.appendChild(prevButton);
        header.appendChild(monthYearDisplay);
        header.appendChild(nextButton);
        this.calendarContainer.appendChild(header);
        // Crear tabla para los días o meses del calendario
        const table = document.createElement('table');
        if (this.type === 'mes') {
            table.className = 'calendar-table-months';
        }
        else {
            table.className = 'calendar-table';
        }
        if (this.type === 'mes') {
            // Mostrar los nombres de los meses
            const months = [
                'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'
            ];
            let row = null;
            months.forEach((month, index) => {
                const cell = document.createElement('div'); // Cambiar de <td> a <div>
                cell.setAttribute('role', 'button');
                cell.setAttribute('aria-label', `Seleccionar ${month} ${this.currentYear}`);
                cell.textContent = month;
                cell.className = 'calendar-month'; // Agregar la clase para los meses
                const monthDate = new Date(this.currentYear, index, 1);
                const endOfMonth = new Date(this.currentYear, index + 1, 0);
                // Deshabilitar meses fuera del rango permitido
                if (monthDate > this.maxDate || endOfMonth < this.minDate) {
                    cell.classList.add('disabled');
                }
                else {
                    cell.addEventListener('click', () => this.selectDate(monthDate));
                }
                table.appendChild(cell); // Agregar directamente al contenedor
            });
        }
        else {
            // Encabezados de los días de la semana
            const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
            const headerRow = document.createElement('tr');
            daysOfWeek.forEach(day => {
                const th = document.createElement('th');
                th.textContent = day;
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);
            // Generar las celdas de los días
            const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
            const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            let date = 1;
            for (let i = 0; i < 6; i++) {
                const row = document.createElement('tr');
                for (let j = 0; j < 7; j++) {
                    const cell = document.createElement('td');
                    if (i === 0 && j < (firstDay === 0 ? 6 : firstDay - 1)) {
                        cell.textContent = '';
                    }
                    else if (date > daysInMonth) {
                        cell.textContent = '';
                    }
                    else {
                        const currentDate = new Date(this.currentYear, this.currentMonth, date);
                        // Verificar si la fecha está deshabilitada
                        const normalizedCurrentDate = this.normalizeDate(currentDate);
                        const normalizedMinDate = this.normalizeDate(this.minDate);
                        const normalizedMaxDate = this.normalizeDate(this.maxDate);
                        const isDisabled = normalizedCurrentDate < normalizedMinDate || normalizedCurrentDate > normalizedMaxDate ||
                            this.disabledDates.some(d => this.normalizeDate(d).getTime() === normalizedCurrentDate.getTime()) ||
                            (this.disableWeekends && (normalizedCurrentDate.getDay() === 0 || normalizedCurrentDate.getDay() === 6));
                        if (!isDisabled) {
                            cell.textContent = date.toString();
                            cell.className = 'calendar-day';
                            cell.addEventListener('click', () => this.selectDate(currentDate));
                            // Resaltar semanas
                            if (this.type === 'semana') {
                                cell.addEventListener('mouseover', () => this.highlightWeek(currentDate));
                                cell.addEventListener('mouseout', () => this.clearHighlight());
                            }
                            // Resaltar rangos
                            if (this.type === 'rango') {
                                cell.addEventListener('mouseover', (event) => this.highlightRange(currentDate, event));
                                cell.addEventListener('mouseout', () => {
                                    this.clearHighlight();
                                    this.hideTooltip();
                                });
                            }
                        }
                        else {
                            cell.textContent = date.toString();
                            cell.className = 'calendar-day disabled';
                        }
                        date++;
                    }
                    row.appendChild(cell);
                }
                table.appendChild(row);
            }
        }
        this.calendarContainer.appendChild(table);
        // Deshabilitar días fuera del rango permitido si hay una fecha seleccionada
        if (this.selectedDates.length > 0) {
            this.disableOutOfRangeDates(this.selectedDates[0]);
        }
        // Emitir el evento renderCompleted
        this.emit('renderCompleted', {
            startDate: this.startDate,
            endDate: this.endDate
        });
    }
    attachInputEvents() {
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
                const day = parseInt(cell.textContent || '0', 10);
                if (isNaN(day) || day === 0)
                    return;
                const cellDate = new Date(this.currentYear, this.currentMonth, day);
                // Verificar si la fecha está dentro del rango permitido
                const isDisabled = cellDate < this.minDate || cellDate > this.maxDate ||
                    this.disabledDates.some(d => d.getTime() === cellDate.getTime()) ||
                    (this.disableWeekends && (cellDate.getDay() === 0 || cellDate.getDay() === 6));
                if (!isDisabled) {
                    cell.classList.remove('disabled');
                    cell.addEventListener('click', this.selectDate); // Rehabilitar selección
                }
                else {
                    cell.classList.add('disabled');
                    cell.removeEventListener('click', this.selectDate); // Evitar selección
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
            if (!this.calendarContainer.contains(event.target) &&
                event.target !== this.inputElement) {
                this.calendarContainer.style.display = 'none';
                this.calendarContainer.classList.remove('open'); // Animación opcional
                this.emit('calendarClosed', {});
            }
        });
    }
    changeMonth(offset) {
        this.currentMonth += offset;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
        // Deshabilitar días fuera del rango permitido si hay una fecha seleccionada
        if (this.selectedDates.length > 0) {
            this.disableOutOfRangeDates(this.selectedDates[0]);
        }
    }
    getMonthName(month) {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[month];
    }
    selectDate(date) {
        if (!this.validateDate(date)) {
            console.error('Fecha inválida proporcionada.');
            return;
        }
        if (date < this.minDate || date > this.maxDate) {
            console.error('La fecha seleccionada está fuera del rango permitido.');
            return;
        }
        if (this.type === 'día') {
            this.selectedDates = [date];
            this.startDate = date;
            this.endDate = null;
            this.updateInput();
            this.calendarContainer.style.display = 'none'; // Ocultar el calendario
            this.emit('dateSelected', { date });
        }
        else if (this.type === 'rango') {
            if (this.selectedDates.length === 0 || this.selectedDates.length === 2) {
                this.selectedDates = [date];
                this.startDate = date;
                this.endDate = null;
                // Aplicar highlight-start a la fecha inicial
                const cells = this.calendarContainer.querySelectorAll('.calendar-day');
                cells.forEach((cell) => {
                    const cellDate = new Date(this.currentYear, this.currentMonth, parseInt(cell.textContent || '0', 10));
                    cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
                    if (cellDate.getTime() === date.getTime()) {
                        cell.classList.add('highlight-start');
                    }
                });
                this.disableOutOfRangeDates(date); // Actualizar días deshabilitados
            }
            else {
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
        }
        else if (this.type === 'semana') {
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
        }
        else if (this.type === 'mes') {
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
    disableOutOfRangeDates(selectedDate) {
        if (this.type !== 'rango') {
            return; // No aplicar deshabilitación para 'día' o 'semana'
        }
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
        const minAllowedDate = new Date(selectedDate);
        minAllowedDate.setDate(minAllowedDate.getDate() + this.minDays - 1);
        const maxAllowedDate = new Date(selectedDate);
        maxAllowedDate.setDate(maxAllowedDate.getDate() + this.maxDays - 1);
        cells.forEach((cell) => {
            const day = parseInt(cell.textContent || '0', 10);
            if (isNaN(day) || day === 0)
                return;
            const cellDate = new Date(this.currentYear, this.currentMonth, day);
            // Deshabilitar días fuera del rango permitido
            if (cellDate < selectedDate || cellDate < minAllowedDate || cellDate > maxAllowedDate) {
                cell.classList.add('disabled');
                cell.removeEventListener('click', this.selectDate); // Evitar selección
            }
        });
    }
    getStartOfWeek(date) {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    }
    getEndOfWeek(date) {
        const startOfWeek = this.getStartOfWeek(date);
        return new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
    }
    updateInput() {
        if (this.fechaVacia) {
            // Mostrar el placeholder si fechaVacia es true
            this.inputElement.value = '';
            this.inputElement.placeholder = this.placeholder;
        }
        else {
            // Manejar los diferentes tipos
            if (this.type === 'mes') {
                if (this.startDate && this.endDate) {
                    const monthNames = [
                        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                        'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'
                    ];
                    const startMonth = monthNames[this.startDate.getMonth()];
                    const year = this.startDate.getFullYear();
                    this.inputElement.value = `${startMonth} ${year}`;
                }
                else {
                    this.inputElement.value = '';
                }
            }
            else if (this.type === 'rango' || this.type === 'semana') {
                if (this.startDate && this.endDate) {
                    const startDate = this.formatDate(this.startDate);
                    const endDate = this.formatDate(this.endDate);
                    this.inputElement.value = `${startDate}${this.dateSeparator}${endDate}`;
                    if (this.startDateInput)
                        this.startDateInput.value = startDate;
                    if (this.endDateInput)
                        this.endDateInput.value = endDate;
                }
                else {
                    this.inputElement.value = '';
                }
            }
            else if (this.type === 'día') {
                if (this.startDate) {
                    const date = this.formatDate(this.startDate);
                    this.inputElement.value = date;
                    if (this.startDateInput)
                        this.startDateInput.value = date;
                    if (this.endDateInput)
                        this.endDateInput.value = '';
                }
                else {
                    this.inputElement.value = '';
                }
            }
        }
    }
    /**
     * Formatea una fecha según el formato proporcionado o el formato configurado.
     * @param date Fecha a formatear.
     * @param format (Opcional) Formato a usar. Si no se proporciona, se usa el formato configurado.
     * @returns Fecha formateada como string.
     */
    formatDate(date, format) {
        const day = String(date.getDate()).padStart(2, '0');
        const monthNames = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];
        const month = monthNames[date.getMonth()];
        const numericMonth = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        // Usar el formato proporcionado o el configurado
        const dateFormat = format || this.dateFormat;
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
    clearSelection() {
        this.selectedDates = [];
        this.updateInput();
        this.renderCalendar(); // Vuelve a renderizar el calendario para habilitar todas las fechas
    }
    /**
     * Actualiza las opciones del calendario dinámicamente.
     * @param newOptions Opciones nuevas o actualizadas.
     */
    updateOptions(newOptions) {
        const allowedKeys = [
            'type', 'minDays', 'maxDays', 'startDate', 'endDate',
            'minDate', 'maxDate', 'dateFormat', 'disabledDates',
            'disableWeekends', 'dateSeparator', 'tooltipText',
            'enableTooltip', 'fechaVacia', 'placeholder'
        ];
        const filteredOptions = {};
        // Validar y asignar valores válidos
        for (const key of allowedKeys) {
            const value = newOptions[key];
            if (value !== undefined) {
                // Validar cada clave según su tipo esperado
                switch (key) {
                    case 'type':
                        if (typeof value === 'string' && ['rango', 'día', 'semana', 'mes'].includes(value)) {
                            filteredOptions[key] = value;
                        }
                        break;
                    case 'minDays':
                    case 'maxDays':
                        if (typeof value === 'number') {
                            filteredOptions[key] = value;
                        }
                        break;
                    case 'startDate':
                    case 'endDate':
                    case 'minDate':
                    case 'maxDate':
                        if (value instanceof Date && !isNaN(value.getTime())) {
                            filteredOptions[key] = value;
                        }
                        break;
                    case 'dateFormat':
                    case 'dateSeparator':
                    case 'placeholder':
                        if (typeof value === 'string') {
                            filteredOptions[key] = value;
                        }
                        break;
                    case 'disabledDates':
                        if (Array.isArray(value) && value.every(date => date instanceof Date && !isNaN(date.getTime()))) {
                            filteredOptions[key] = value;
                        }
                        break;
                    case 'disableWeekends':
                    case 'enableTooltip':
                    case 'fechaVacia':
                        if (typeof value === 'boolean') {
                            filteredOptions[key] = value;
                        }
                        break;
                    case 'tooltipText':
                        if (typeof value === 'object' && value !== null && 'one' in value && 'other' in value) {
                            filteredOptions[key] = value;
                        }
                        break;
                }
            }
        }
        // Validaciones adicionales
        if (filteredOptions.minDays !== undefined && filteredOptions.maxDays !== undefined && filteredOptions.minDays > filteredOptions.maxDays) {
            throw new Error('minDays no puede ser mayor que maxDays.');
        }
        if (filteredOptions.startDate && (filteredOptions.startDate < this.minDate || filteredOptions.startDate > this.maxDate)) {
            throw new Error('startDate está fuera del rango permitido.');
        }
        if (filteredOptions.endDate && (filteredOptions.endDate < this.minDate || filteredOptions.endDate > this.maxDate)) {
            throw new Error('endDate está fuera del rango permitido.');
        }
        // Asignar las opciones filtradas al calendario
        Object.assign(this, filteredOptions);
        this.renderCalendar();
    }
    /**
     * Devuelve las fechas seleccionadas en un formato específico.
     * @returns Un objeto con las fechas seleccionadas (inicio y fin).
     */
    getSelectedDates() {
        const startDate = this.selectedDates[0] ? this.formatDate(this.selectedDates[0]) : null;
        const endDate = this.selectedDates[1] ? this.formatDate(this.selectedDates[1]) : null;
        return { startDate, endDate };
    }
    /**
     * Resalta los días de la semana correspondiente a la fecha proporcionada.
     * @param date Fecha para calcular la semana.
     */
    highlightWeek(date) {
        let startOfWeek = this.getStartOfWeek(date);
        let endOfWeek = this.getEndOfWeek(date);
        // Ajustar el rango si los fines de semana están deshabilitados
        if (this.disableWeekends) {
            if (startOfWeek.getDay() === 0) {
                startOfWeek.setDate(startOfWeek.getDate() + 1); // Mover al lunes
            }
            if (endOfWeek.getDay() === 6 || endOfWeek.getDay() === 0) {
                endOfWeek.setDate(endOfWeek.getDate() - (endOfWeek.getDay() === 6 ? 1 : 2)); // Mover al viernes
            }
        }
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
        cells.forEach((cell) => {
            const cellDate = new Date(this.currentYear, this.currentMonth, parseInt(cell.textContent || '0', 10));
            // Verificar si el día está dentro del rango ajustado
            if (cellDate >= startOfWeek && cellDate <= endOfWeek) {
                const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
                if (this.disableWeekends && isWeekend) {
                    return; // No resaltar fines de semana si están deshabilitados
                }
                if (cellDate.getTime() === startOfWeek.getTime()) {
                    cell.classList.add('highlight-start');
                }
                else if (cellDate.getTime() === endOfWeek.getTime()) {
                    cell.classList.add('highlight-end');
                }
                else {
                    cell.classList.add('highlight-range');
                }
            }
        });
    }
    /**
     * Resalta los días dentro del rango dinámico al mover el mouse.
     * @param endDate Fecha final del rango.
     */
    highlightRange(endDate, event) {
        if (this.selectedDates.length === 0) {
            this.hideTooltip(); // Ocultar el tooltip si no hay una fecha de inicio seleccionada
            return;
        }
        const startDate = this.selectedDates[0];
        // Calcular la fecha máxima permitida basada en maxDays
        const maxAllowedDate = new Date(startDate);
        maxAllowedDate.setDate(maxAllowedDate.getDate() + this.maxDays - 1);
        // Validar que la fecha final no exceda el rango permitido
        if (endDate > maxAllowedDate) {
            this.hideTooltip();
            return;
        }
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
        cells.forEach((cell) => {
            const cellDate = new Date(this.currentYear, this.currentMonth, parseInt(cell.textContent || '0', 10));
            // Limpiar clases previas
            cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
            // Si solo hay una fecha seleccionada, aplicar highlight-start
            if (this.selectedDates.length === 1 && cellDate.getTime() === startDate.getTime()) {
                cell.classList.add('highlight-start');
            }
            // Si hay un rango definido, aplicar las clases correspondientes
            if (cellDate >= startDate && cellDate <= endDate) {
                if (cellDate.getTime() === startDate.getTime()) {
                    cell.classList.add('highlight-start');
                }
                else if (cellDate.getTime() === endDate.getTime()) {
                    cell.classList.add('highlight-end');
                }
                else {
                    cell.classList.add('highlight-range');
                }
            }
        });
        // Mostrar el tooltip solo si está habilitado
        if (this.enableTooltip && event) {
            const diff = Math.abs(Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) + 1;
            const text = diff === 1 ? `${diff} ${this.tooltipText.one}` : `${diff} ${this.tooltipText.other}`;
            this.showTooltip(text, event.clientX, event.clientY);
        }
    }
    /**
     * Muestra un tooltip con el número de días seleccionados.
     * @param text Texto a mostrar en el tooltip.
     * @param x Posición X del mouse.
     * @param y Posición Y del mouse.
     */
    showTooltip(text, x, y) {
        let tooltip = document.querySelector('.calendar-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'calendar-tooltip';
            this.calendarContainer.appendChild(tooltip);
        }
        tooltip.textContent = text;
        const maxX = window.innerWidth - tooltip.offsetWidth;
        const maxY = window.innerHeight - tooltip.offsetHeight;
        tooltip.style.left = `${Math.min(x + 10, maxX)}px`;
        tooltip.style.top = `${Math.min(y + 10, maxY)}px`;
        tooltip.style.display = 'block';
    }
    /**
     * Oculta el tooltip.
     */
    hideTooltip() {
        const tooltip = document.querySelector('.calendar-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    /**
     * Limpia el resaltado de los días de la semana.
     */
    clearHighlight() {
        const cells = this.calendarContainer.querySelectorAll('.calendar-day');
        cells.forEach((cell) => {
            cell.classList.remove('highlight-start', 'highlight-range', 'highlight-end');
        });
    }
    /**
     * Fuerza la emisión del evento renderCompleted.
     */
    triggerRenderCompleted() {
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
    normalizeDate(date) {
        const normalizedDate = new Date(date);
        normalizedDate.setUTCHours(0, 0, 0, 0); // Establecer la hora en UTC
        return normalizedDate;
    }
    changeYear(offset) {
        this.currentYear += offset;
        this.renderCalendar();
    }
    validateDate(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }
    destroy() {
        document.removeEventListener('click', this.globalClickHandler);
        this.calendarContainer.replaceChildren(); // Limpia el contenedor
        this.events = {}; // Limpia los eventos registrados
        console.log('RangeCalendar destruido.');
    }
}
export default RangeCalendar;
